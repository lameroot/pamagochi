import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChildProfile, ParentAccount } from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ChildOwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async requireOwnedChild(childId: string, parent: ParentAccount): Promise<ChildProfile> {
    const child = await this.prisma.client.childProfile.findUnique({ where: { id: childId } });
    if (!child || child.parentId !== parent.id || child.deletedAt) {
      throw new NotFoundException('Child profile was not found');
    }
    return child;
  }
}
