import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createParentMemoryRequestSchema,
  type ListMemoryResponse,
  type MemoryDetailDto,
  type MemoryItemDto,
  updateMemoryRequestSchema,
} from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { ParentApiRateLimitGuard } from '../common/rate-limit.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { ChildOwnershipService } from '../profiles/child-ownership.service.js';
import { MemoryPolicyService } from './memory-policy.service.js';
import { ParentMemoryService } from './parent-memory.service.js';

@Controller('api/children/:childId/memory')
@UseGuards(AuthGuard, ParentApiRateLimitGuard)
export class ParentMemoryController {
  constructor(
    private readonly ownership: ChildOwnershipService,
    private readonly memory: ParentMemoryService,
    private readonly policy: MemoryPolicyService,
  ) {}

  @Get()
  async list(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ListMemoryResponse> {
    await this.ownership.requireOwnedChild(childId, parent);
    return this.memory.list(childId);
  }

  @Post()
  async create(
    @Param('childId') childId: string,
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<MemoryItemDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    const parsed = createParentMemoryRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }
    this.policy.validate({
      category: parsed.data.category,
      fact: parsed.data.fact,
      source: 'parent',
    });
    return this.memory.createParentNote(childId, parent.id, parsed.data.fact);
  }

  @Get(':memoryId')
  async getOne(
    @Param('childId') childId: string,
    @Param('memoryId') memoryId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<MemoryDetailDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    return this.memory.getDetail(childId, memoryId);
  }

  @Patch(':memoryId')
  async update(
    @Param('childId') childId: string,
    @Param('memoryId') memoryId: string,
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<MemoryItemDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    const parsed = updateMemoryRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }
    if (parsed.data.fact) {
      this.policy.validate({
        category: 'parent_note',
        fact: parsed.data.fact,
        source: 'parent',
      });
    }
    return this.memory.update(childId, memoryId, parent.id, parsed.data);
  }

  @Delete(':memoryId')
  async remove(
    @Param('childId') childId: string,
    @Param('memoryId') memoryId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<{ ok: true }> {
    await this.ownership.requireOwnedChild(childId, parent);
    await this.memory.softDelete(childId, memoryId, parent.id);
    return { ok: true };
  }
}
