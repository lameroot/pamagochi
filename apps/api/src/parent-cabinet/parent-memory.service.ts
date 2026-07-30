import { Injectable, NotFoundException } from '@nestjs/common';
import type { MemoryDetailDto, MemoryItemDto, UpdateMemoryRequest } from '@pamagochi/contracts';
import type { MemoryCategory, MemoryItemStatus } from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';

function serializeMemory(item: {
  id: string;
  childId: string;
  category: MemoryCategory;
  fact: string;
  status: MemoryItemStatus;
  source: 'automatic' | 'parent';
  confidence: number;
  priority: number;
  pinned: boolean;
  sourceSessionId: string | null;
  sourceTurnIds: string[];
  reviewAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MemoryItemDto {
  return {
    id: item.id,
    childId: item.childId,
    category: item.category,
    fact: item.fact,
    status: item.status,
    source: item.source,
    confidence: item.confidence,
    priority: item.priority,
    pinned: item.pinned,
    sourceSessionId: item.sourceSessionId,
    sourceTurnIds: item.sourceTurnIds,
    reviewAfter: item.reviewAfter?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

@Injectable()
export class ParentMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(childId: string): Promise<{ items: MemoryItemDto[] }> {
    const items = await this.prisma.client.memoryItem.findMany({
      where: { childId, status: { not: 'deleted' }, deletedAt: null },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });
    return { items: items.map(serializeMemory) };
  }

  async getDetail(childId: string, memoryId: string): Promise<MemoryDetailDto> {
    const item = await this.prisma.client.memoryItem.findUnique({
      where: { id: memoryId },
      include: { versions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!item || item.childId !== childId || item.status === 'deleted' || item.deletedAt) {
      throw new NotFoundException('Memory item was not found');
    }
    return {
      ...serializeMemory(item),
      versions: item.versions.map((v) => ({
        id: v.id,
        memoryItemId: v.memoryItemId,
        previousFact: v.previousFact,
        newFact: v.newFact,
        changedBy: v.changedBy,
        changedByUserId: v.changedByUserId,
        reason: v.reason,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }

  async createParentNote(childId: string, parentId: string, fact: string): Promise<MemoryItemDto> {
    const item = await this.prisma.client.memoryItem.create({
      data: {
        childId,
        category: 'parent_note',
        fact: fact.trim(),
        status: 'active',
        source: 'parent',
        confidence: 1,
        priority: 50,
        pinned: false,
        versions: {
          create: {
            newFact: fact.trim(),
            changedBy: 'parent',
            changedByUserId: parentId,
            reason: 'parent_created',
          },
        },
      },
    });
    return serializeMemory(item);
  }

  async update(
    childId: string,
    memoryId: string,
    parentId: string,
    input: UpdateMemoryRequest,
  ): Promise<MemoryItemDto> {
    const existing = await this.prisma.client.memoryItem.findUnique({ where: { id: memoryId } });
    if (!existing || existing.childId !== childId || existing.status === 'deleted') {
      throw new NotFoundException('Memory item was not found');
    }

    const newFact = input.fact?.trim() ?? existing.fact;
    const item = await this.prisma.client.memoryItem.update({
      where: { id: memoryId },
      data: {
        fact: input.fact !== undefined ? newFact : undefined,
        status: input.status,
        pinned: input.pinned,
        versions:
          input.fact !== undefined && newFact !== existing.fact
            ? {
                create: {
                  previousFact: existing.fact,
                  newFact,
                  changedBy: 'parent',
                  changedByUserId: parentId,
                  reason: input.reason ?? 'parent_edit',
                },
              }
            : input.status !== undefined || input.pinned !== undefined
              ? {
                  create: {
                    previousFact: existing.fact,
                    newFact: existing.fact,
                    changedBy: 'parent',
                    changedByUserId: parentId,
                    reason: input.reason ?? 'parent_metadata_change',
                  },
                }
              : undefined,
      },
    });
    return serializeMemory(item);
  }

  async softDelete(childId: string, memoryId: string, parentId: string): Promise<void> {
    const existing = await this.prisma.client.memoryItem.findUnique({ where: { id: memoryId } });
    if (!existing || existing.childId !== childId || existing.status === 'deleted') {
      throw new NotFoundException('Memory item was not found');
    }

    await this.prisma.client.memoryItem.update({
      where: { id: memoryId },
      data: {
        status: 'deleted',
        deletedAt: new Date(),
        versions: {
          create: {
            previousFact: existing.fact,
            newFact: existing.fact,
            changedBy: 'parent',
            changedByUserId: parentId,
            reason: 'parent_deleted',
          },
        },
      },
    });
  }
}
