import { Module } from '@nestjs/common';
import { IntroProgressController } from './intro-progress.controller.js';
import { IntroProgressService } from './intro-progress.service.js';

@Module({
  controllers: [IntroProgressController],
  providers: [IntroProgressService],
  exports: [IntroProgressService],
})
export class IntroProgressModule {}
