import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  type ChildOverviewDto,
  conversationsQuerySchema,
  type ConversationDetailDto,
  type PaginatedConversationsResponse,
} from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { ParentApiRateLimitGuard } from '../common/rate-limit.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { ChildOwnershipService } from '../profiles/child-ownership.service.js';
import { ChildOverviewService } from './child-overview.service.js';
import { ParentConversationsService } from './parent-conversations.service.js';

@Controller('api/children/:childId')
@UseGuards(AuthGuard, ParentApiRateLimitGuard)
export class ChildOverviewController {
  constructor(
    private readonly ownership: ChildOwnershipService,
    private readonly overview: ChildOverviewService,
    private readonly conversations: ParentConversationsService,
  ) {}

  @Get('overview')
  async getOverview(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildOverviewDto> {
    const child = await this.ownership.requireOwnedChild(childId, parent);
    return this.overview.build(child);
  }

  @Get('conversations')
  async listConversations(
    @Param('childId') childId: string,
    @Query() query: Record<string, string | undefined>,
    @CurrentParent() parent: ParentAccount,
  ): Promise<PaginatedConversationsResponse> {
    await this.ownership.requireOwnedChild(childId, parent);
    const parsed = conversationsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return { items: [], nextCursor: null };
    }
    return this.conversations.list(childId, parsed.data);
  }

  @Get('conversations/:conversationId')
  async getConversation(
    @Param('childId') childId: string,
    @Param('conversationId') conversationId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ConversationDetailDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    return this.conversations.getDetail(childId, conversationId);
  }
}
