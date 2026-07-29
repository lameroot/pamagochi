import { BadRequestException, Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  createGameSessionRequestSchema,
  type CreateGameSessionResponse,
} from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { GameSessionsService } from './game-sessions.service.js';

@Controller('api/children')
@UseGuards(AuthGuard)
export class GameSessionsController {
  constructor(private readonly gameSessions: GameSessionsService) {}

  @Post(':childId/game-sessions')
  async create(
    @Param('childId') childId: string,
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<CreateGameSessionResponse> {
    const parsed = createGameSessionRequestSchema.safeParse({
      ...(typeof body === 'object' && body ? body : {}),
      childId,
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }

    return this.gameSessions.createForParent({
      parent,
      childId: parsed.data.childId,
      deviceId: parsed.data.deviceId,
    });
  }

  @Post('game-sessions/:sessionId/revoke')
  async revoke(
    @Param('sessionId') sessionId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<{ ok: true }> {
    await this.gameSessions.revoke(sessionId, parent);
    return { ok: true };
  }
}
