import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { gameBootstrapRequestSchema, type GameBootstrapResponse } from '@pamagochi/contracts';
import { GameSessionsService } from './game-sessions.service.js';

/**
 * Public to the game client (no parent JWT). Authenticated via limited-game-token.
 */
@Controller('api/game')
export class GameBootstrapController {
  constructor(private readonly gameSessions: GameSessionsService) {}

  @Post('bootstrap')
  @HttpCode(200)
  async bootstrap(@Body() body: unknown): Promise<GameBootstrapResponse> {
    const parsed = gameBootstrapRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }
    return this.gameSessions.bootstrap(parsed.data.limitedGameToken);
  }
}
