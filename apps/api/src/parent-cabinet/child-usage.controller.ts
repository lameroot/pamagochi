import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { ChildUsageSummaryDto } from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { ParentApiRateLimitGuard } from '../common/rate-limit.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { ChildOwnershipService } from '../profiles/child-ownership.service.js';
import { ChildUsageService } from './child-usage.service.js';

@Controller('api/children/:childId')
@UseGuards(AuthGuard, ParentApiRateLimitGuard)
export class ChildUsageController {
  constructor(
    private readonly ownership: ChildOwnershipService,
    private readonly usage: ChildUsageService,
  ) {}

  @Get('usage')
  async getUsage(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildUsageSummaryDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    return this.usage.getDailySummary(childId);
  }
}
