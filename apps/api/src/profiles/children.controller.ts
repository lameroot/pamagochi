import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  type ChildProfileDto,
  createChildProfileRequestSchema,
  type ListChildProfilesResponse,
  updateChildProfileRequestSchema,
} from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { PrismaService } from '../database/prisma.service.js';
import { ChildOwnershipService } from './child-ownership.service.js';
import { serializeChild } from './child-serializer.js';

@Controller('api/children')
@UseGuards(AuthGuard)
export class ChildrenController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: ChildOwnershipService,
  ) {}

  @Get()
  async list(@CurrentParent() parent: ParentAccount): Promise<ListChildProfilesResponse> {
    const children = await this.prisma.client.childProfile.findMany({
      where: { parentId: parent.id, deletedAt: null },
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
        birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
        primaryLanguage: parsed.data.primaryLanguage,
        readingLevel: parsed.data.readingLevel ?? null,
        mathLevel: parsed.data.mathLevel ?? null,
      },
    });

    return serializeChild(child);
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildProfileDto> {
    const child = await this.ownership.requireOwnedChild(id, parent);
    return serializeChild(child);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildProfileDto> {
    await this.ownership.requireOwnedChild(id, parent);
    const parsed = updateChildProfileRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const child = await this.prisma.client.childProfile.update({
      where: { id },
      data: {
        displayName: parsed.data.displayName,
        avatarKey: parsed.data.avatarKey,
        birthYear: parsed.data.birthYear,
        birthDate:
          parsed.data.birthDate === undefined
            ? undefined
            : parsed.data.birthDate
              ? new Date(parsed.data.birthDate)
              : null,
        primaryLanguage: parsed.data.primaryLanguage,
        readingLevel: parsed.data.readingLevel,
        mathLevel: parsed.data.mathLevel,
      },
    });

    return serializeChild(child);
  }

  @Delete(':id')
  async softDelete(
    @Param('id') id: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<{ ok: true }> {
    await this.ownership.requireOwnedChild(id, parent);
    await this.prisma.client.childProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }
}
