import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  IntroProgressDto,
  IntroProgressTransitionRequest,
  IntroProgressTransitionResponse,
} from '@pamagochi/contracts';
import {
  applyIntroTransition,
  introWorldContextFor,
  isIntroCompleted,
  isIntroState,
  type IntroState,
} from '@pamagochi/game-protocol';
import { PrismaService } from '../database/prisma.service.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toDto(row: {
  state: string;
  sharedEventsJson: unknown;
  completedAt: Date | null;
  updatedAt: Date;
}): IntroProgressDto {
  const sharedEvents = Array.isArray(row.sharedEventsJson)
    ? (row.sharedEventsJson as string[])
    : [];
  const state = isIntroState(row.state) ? row.state : 'SHIP_DARK';
  return {
    state,
    sharedEvents,
    completed: isIntroCompleted(state) || row.completedAt !== null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class IntroProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForChild(childId: string): Promise<IntroProgressDto> {
    const row = await this.prisma.client.introProgress.upsert({
      where: { childId },
      create: { childId, state: 'SHIP_DARK' },
      update: {},
    });
    return toDto(row);
  }

  async getForGameToken(limitedGameToken: string): Promise<IntroProgressDto> {
    const childId = await this.resolveChildIdFromToken(limitedGameToken);
    return this.getOrCreateForChild(childId);
  }

  async transition(
    input: IntroProgressTransitionRequest,
  ): Promise<IntroProgressTransitionResponse> {
    const childId = await this.resolveChildIdFromToken(input.limitedGameToken);
    const existingRow = await this.prisma.client.introProgress.upsert({
      where: { childId },
      create: { childId, state: 'SHIP_DARK' },
      update: {},
    });
    const existing = toDto(existingRow);

    // Idempotent replay: same key must also match the state it previously produced.
    // Reusing a key with a different target state is a client bug, not a safe no-op.
    if (existingRow.lastIdempotencyKey && existingRow.lastIdempotencyKey === input.idempotencyKey) {
      if (existing.state !== input.targetState) {
        throw new BadRequestException('Idempotency key already used for a different target state');
      }
      return { progress: existing, changed: false };
    }

    const from = existing.state;
    const transition = applyIntroTransition(from, input.targetState);
    if (!transition.ok) {
      throw new BadRequestException(`Intro transition rejected: ${transition.reason}`);
    }

    if (!transition.changed) {
      await this.prisma.client.introProgress.update({
        where: { childId },
        data: { lastIdempotencyKey: input.idempotencyKey },
      });
      return { progress: existing, changed: false };
    }

    const sharedEvents = [...existing.sharedEvents];
    if (input.sharedEvent && !sharedEvents.includes(input.sharedEvent)) {
      sharedEvents.push(input.sharedEvent.slice(0, 128));
    }
    if (input.sourceEvent && !sharedEvents.includes(input.sourceEvent)) {
      sharedEvents.push(input.sourceEvent.slice(0, 128));
    }

    const completedAt = input.targetState === 'INTRO_COMPLETED' ? new Date() : null;

    const row = await this.prisma.client.introProgress.update({
      where: { childId },
      data: {
        state: input.targetState,
        sharedEventsJson: sharedEvents,
        lastIdempotencyKey: input.idempotencyKey,
        ...(completedAt ? { completedAt } : {}),
      },
    });

    if (input.targetState === 'INTRO_COMPLETED') {
      await this.prisma.client.relationshipState.upsert({
        where: { childId },
        create: {
          childId,
          stage: 'first_meeting',
          sharedEventsJson: sharedEvents,
        },
        update: {
          sharedEventsJson: sharedEvents,
          lastSessionAt: new Date(),
        },
      });
    }

    return { progress: toDto(row), changed: true };
  }

  worldStateFor(state: IntroState): Record<string, unknown> {
    return introWorldContextFor(state) as unknown as Record<string, unknown>;
  }

  sceneKeyFor(state: IntroState): string {
    return isIntroCompleted(state) ? 'talking-light' : 'ship-capsule-intro';
  }

  private async resolveChildIdFromToken(limitedGameToken: string): Promise<string> {
    const tokenHash = hashToken(limitedGameToken);
    const session = await this.prisma.client.gameSession.findUnique({
      where: { tokenHash },
      include: { child: true },
    });
    if (!session) {
      throw new UnauthorizedException('Game session token is invalid');
    }
    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Game session is not active');
    }
    if (session.child.deletedAt) {
      throw new NotFoundException('Child profile is not available');
    }
    return session.childId;
  }
}
