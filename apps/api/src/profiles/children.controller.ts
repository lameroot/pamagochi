import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  type ChildProfileDto,
  createChildProfileRequestSchema,
  type ListChildProfilesResponse,
} from '@pamagochi/contracts';
import type { ChildProfile, ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { PrismaService } from '../database/prisma.service.js';

function serializeChild(child: ChildProfile): ChildProfileDto {
  return {
    id: child.id,
    parentId: child.parentId,
    displayName: child.displayName,
    avatarKey: child.avatarKey,
    birthYear: child.birthYear,
    createdAt: child.createdAt.toISOString(),
    updatedAt: child.updatedAt.toISOString(),
  };
}

@Controller('api/children')
@UseGuards(AuthGuard)
export class ChildrenController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentParent() parent: ParentAccount): Promise<ListChildProfilesResponse> {
    const children = await this.prisma.client.childProfile.findMany({
      where: { parentId: parent.id },
      orderBy: { createdAt: 'asc' },
    });
    return { children: children.map(serializeChild) };
  }

  @Post()
  async create(
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildProfileDto> {
    const parsed = createChildProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const child = await this.prisma.client.childProfile.create({
      data: {
        parentId: parent.id,
        displayName: parsed.data.displayName,
        avatarKey: parsed.data.avatarKey,
        birthYear: parsed.data.birthYear ?? null,
      },
    });

    return serializeChild(child);
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildProfileDto> {
    const child = await this.prisma.client.childProfile.findUnique({ where: { id } });
    // Ownership check: a parent must never be able to read another
    // parent's child by guessing an id — return the same 404 either way.
    if (!child || child.parentId !== parent.id) {
      throw new NotFoundException('Child profile was not found');
    }
    return serializeChild(child);
  }
}
