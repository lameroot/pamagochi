import { Controller, Get, UseGuards } from '@nestjs/common';
import type { MeResponse } from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';

@Controller('api/me')
@UseGuards(AuthGuard)
export class MeController {
  @Get()
  getMe(@CurrentParent() parent: ParentAccount): MeResponse {
    return {
      parent: {
        id: parent.id,
        email: parent.email,
        createdAt: parent.createdAt.toISOString(),
      },
    };
  }
}
