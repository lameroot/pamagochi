import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IntroProgressModule } from '../intro-progress/intro-progress.module.js';
import { GameBootstrapController } from './game-bootstrap.controller.js';
import { GameSessionsController } from './game-sessions.controller.js';
import { GameSessionsService } from './game-sessions.service.js';
import { LivekitTokenService } from './livekit-token.service.js';

@Module({
  imports: [AuthModule, IntroProgressModule],
  controllers: [GameSessionsController, GameBootstrapController],
  providers: [GameSessionsService, LivekitTokenService],
  exports: [GameSessionsService, LivekitTokenService],
})
export class GameSessionsModule {}
