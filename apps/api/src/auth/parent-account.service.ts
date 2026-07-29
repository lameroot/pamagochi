import { Injectable } from '@nestjs/common';
import type { AuthenticatedIdentity } from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ParentAccountService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent: creates the ParentAccount on first sight of a subject, updates email otherwise. */
  async upsertFromIdentity(identity: AuthenticatedIdentity): Promise<ParentAccount> {
    return this.prisma.client.parentAccount.upsert({
      where: { authSubject: identity.subject },
      update: { email: identity.email ?? null },
      create: { authSubject: identity.subject, email: identity.email ?? null },
    });
  }
}
