import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CreateGameSessionResponse, GameBootstrapResponse } from '@pamagochi/contracts';
import type { ChildProfile, ParentAccount } from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ageBandFromBirth } from './age-band.js';
import { LivekitTokenService } from './livekit-token.service.js';

const DEFAULT_SESSION_TTL_SECONDS = 2 * 60 * 60;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class GameSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly livekit: LivekitTokenService,
  ) {}

  async createForParent(input: {
    parent: ParentAccount;
    childId: string;
    deviceId?: string;
  }): Promise<CreateGameSessionResponse> {
    const child = await this.prisma.client.childProfile.findUnique({
      where: { id: input.childId },
    });
    if (!child || child.parentId !== input.parent.id || child.deletedAt) {
      throw new NotFoundException('Child profile was not found');
    }

    const maxConcurrent = this.config.voiceMaxConcurrentSessionsPerChild;
    const activeCount = await this.prisma.client.gameSession.count({
      where: {
        childId: child.id,
        status: { in: ['pending', 'active'] },
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
    });
    if (activeCount >= maxConcurrent) {
      throw new ConflictException('An active game session already exists for this child');
    }

    const limitedGameToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(limitedGameToken);
    const ttlSeconds = this.config.voiceSessionMaxDurationSeconds || DEFAULT_SESSION_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const session = await this.prisma.client.gameSession.create({
      data: {
        childId: child.id,
        deviceId: input.deviceId ?? null,
        tokenHash,
        status: 'pending',
        expiresAt,
        createdByParentId: input.parent.id,
      },
    });

    return {
      gameSessionId: session.id,
      limitedGameToken,
      expiresAt: expiresAt.toISOString(),
      gameLaunchPath: `/play?token=${encodeURIComponent(limitedGameToken)}`,
    };
  }

  async bootstrap(limitedGameToken: string): Promise<GameBootstrapResponse> {
    const tokenHash = hashToken(limitedGameToken);
    const session = await this.prisma.client.gameSession.findUnique({
      where: { tokenHash },
      include: { child: true },
    });

    if (!session) {
      throw new UnauthorizedException('Game session token is invalid');
    }
    if (session.revokedAt || session.status === 'revoked') {
      throw new ForbiddenException('Game session was revoked');
    }
    if (session.expiresAt.getTime() <= Date.now() || session.status === 'expired') {
      throw new ForbiddenException('Game session expired');
    }
    if (session.child.deletedAt) {
      throw new ForbiddenException('Child profile is not available');
    }

    if (session.status === 'pending') {
      await this.prisma.client.gameSession.update({
        where: { id: session.id },
        data: { status: 'active' },
      });
    }

    const roomName = `game-${session.id}`;
    const ttlSeconds = Math.max(60, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    const livekitToken = await this.livekit.createRoomToken({
      roomName,
      identity: `child-${session.childId}`,
      ttlSeconds,
      canPublish: true,
      canSubscribe: true,
    });

    return {
      protocolVersion: '1',
      gameSessionId: session.id,
      child: {
        id: session.child.id,
        displayName: session.child.displayName,
        ageBand: ageBandFromBirth({
          birthYear: session.child.birthYear,
          birthDate: session.child.birthDate,
        }),
        primaryLanguage: session.child.primaryLanguage,
      },
      livekit: {
        url: this.livekit.getLivekitUrl(),
        roomName,
        token: livekitToken,
      },
      initialAgentState: 'connecting',
      sceneKey: 'talking-light',
    };
  }

  async revoke(sessionId: string, parent: ParentAccount): Promise<void> {
    const session = await this.prisma.client.gameSession.findUnique({ where: { id: sessionId } });
    if (!session || session.createdByParentId !== parent.id) {
      throw new NotFoundException('Game session was not found');
    }
    await this.prisma.client.gameSession.update({
      where: { id: sessionId },
      data: { status: 'revoked', revokedAt: new Date() },
    });
  }

  /** Test helper / ownership assertions. */
  async getOwnedChild(childId: string, parentId: string): Promise<ChildProfile> {
    const child = await this.prisma.client.childProfile.findUnique({ where: { id: childId } });
    if (!child || child.parentId !== parentId) {
      throw new NotFoundException('Child profile was not found');
    }
    return child;
  }
}
