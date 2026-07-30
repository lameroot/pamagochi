import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { type PaginatedSafetyEventsResponse, safetyEventsQuerySchema } from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { ParentApiRateLimitGuard } from '../common/rate-limit.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { ChildOwnershipService } from '../profiles/child-ownership.service.js';
import { ParentSafetyService } from './parent-safety.service.js';

@Controller('api/children/:childId/safety')
@UseGuards(AuthGuard, ParentApiRateLimitGuard)
export class ParentSafetyController {
  constructor(
    private readonly ownership: ChildOwnershipService,
    private readonly safety: ParentSafetyService,
  ) {}

  @Get()
  async list(
    @Param('childId') childId: string,
    @Query() query: Record<string, string | undefined>,
    @CurrentParent() parent: ParentAccount,
  ): Promise<PaginatedSafetyEventsResponse> {
    await this.ownership.requireOwnedChild(childId, parent);
    const parsed = safetyEventsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return { items: [], nextCursor: null };
    }
    return this.safety.list(childId, parsed.data);
  }
}
