import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  grantPrivacyConsentRequestSchema,
  type ListPrivacyConsentsResponse,
  type PrivacyConsentDto,
} from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { PrismaService } from '../database/prisma.service.js';
import { ChildOwnershipService } from '../profiles/child-ownership.service.js';

function serializeConsent(consent: {
  id: string;
  childId: string;
  consentType: string;
  version: string;
  grantedAt: Date;
  revokedAt: Date | null;
  metadataJson: unknown;
}): PrivacyConsentDto {
  return {
    id: consent.id,
    childId: consent.childId,
    consentType: consent.consentType as PrivacyConsentDto['consentType'],
    version: consent.version,
    grantedAt: consent.grantedAt.toISOString(),
    revokedAt: consent.revokedAt?.toISOString() ?? null,
    metadata:
      consent.metadataJson &&
      typeof consent.metadataJson === 'object' &&
      !Array.isArray(consent.metadataJson)
        ? (consent.metadataJson as Record<string, unknown>)
        : {},
  };
}

@Controller('api/children/:childId/consents')
@UseGuards(AuthGuard)
export class PrivacyConsentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: ChildOwnershipService,
  ) {}

  @Get()
  async list(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ListPrivacyConsentsResponse> {
    await this.ownership.requireOwnedChild(childId, parent);
    const consents = await this.prisma.client.privacyConsent.findMany({
      where: { childId, parentUserId: parent.id },
      orderBy: { grantedAt: 'desc' },
    });
    return { consents: consents.map(serializeConsent) };
  }

  @Post()
  async grant(
    @Param('childId') childId: string,
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<PrivacyConsentDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    const parsed = grantPrivacyConsentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const active = await this.prisma.client.privacyConsent.findFirst({
      where: {
        childId,
        consentType: parsed.data.consentType,
        revokedAt: null,
      },
      orderBy: { grantedAt: 'desc' },
    });
    if (active) {
      return serializeConsent(active);
    }

    const consent = await this.prisma.client.privacyConsent.create({
      data: {
        parentUserId: parent.id,
        childId,
        consentType: parsed.data.consentType,
        version: parsed.data.version,
        metadataJson: parsed.data.metadata as object,
      },
    });
    return serializeConsent(consent);
  }

  @Post(':consentType/revoke')
  async revoke(
    @Param('childId') childId: string,
    @Param('consentType') consentType: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<PrivacyConsentDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    const active = await this.prisma.client.privacyConsent.findFirst({
      where: { childId, parentUserId: parent.id, consentType, revokedAt: null },
      orderBy: { grantedAt: 'desc' },
    });
    if (!active) {
      throw new BadRequestException('No active consent to revoke');
    }

    const revoked = await this.prisma.client.privacyConsent.update({
      where: { id: active.id },
      data: { revokedAt: new Date() },
    });
    return serializeConsent(revoked);
  }
}
