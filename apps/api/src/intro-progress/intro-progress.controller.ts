import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  introProgressTransitionRequestSchema,
  type IntroProgressTransitionResponse,
} from '@pamagochi/contracts';
import { IntroProgressService } from './intro-progress.service.js';

@Controller('api/game')
export class IntroProgressController {
  constructor(private readonly introProgress: IntroProgressService) {}

  @Post('intro-progress/transition')
  @HttpCode(200)
  async transition(@Body() body: unknown): Promise<IntroProgressTransitionResponse> {
    const parsed = introProgressTransitionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }
    return this.introProgress.transition(parsed.data);
  }
}
