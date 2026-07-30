import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ChildDataExportDto,
  ChildPrivacySettingsDto,
  UpdateChildPrivacySettingsRequest,
} from '@pamagochi/contracts';
import { PrismaService } from '../database/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class ParentPrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async getSettings(childId: string, parentId: string): Promise<ChildPrivacySettingsDto> {
    const retention = await this.getActiveConsent(childId, parentId, 'transcript_retention');
    const audio = await this.getActiveConsent(childId, parentId, 'audio_recording');

    const retentionDays =
      retention?.metadataJson &&
      typeof retention.metadataJson === 'object' &&
      !Array.isArray(retention.metadataJson) &&
      typeof (retention.metadataJson as { days?: unknown }).days === 'number'
        ? ((retention.metadataJson as { days: number }).days ?? null)
        : null;

    return {
      transcriptRetentionDays: retentionDays,
      audioRecordingConsent: audio !== null,
      audioRecordingPermitted: this.config.audioRecordingEnabled,
    };
  }

  async updateSettings(
    childId: string,
    parentId: string,
    input: UpdateChildPrivacySettingsRequest,
  ): Promise<ChildPrivacySettingsDto> {
    if (input.transcriptRetentionDays !== undefined) {
      if (input.transcriptRetentionDays === null) {
        await this.revokeConsent(childId, parentId, 'transcript_retention');
      } else {
        await this.grantConsent(childId, parentId, 'transcript_retention', '1', {
          days: input.transcriptRetentionDays,
        });
      }
    }

    if (input.audioRecordingConsent !== undefined) {
      if (input.audioRecordingConsent) {
        await this.grantConsent(childId, parentId, 'audio_recording', '1', {});
      } else {
        await this.revokeConsent(childId, parentId, 'audio_recording');
      }
    }

    return this.getSettings(childId, parentId);
  }

  async deleteConversation(
    childId: string,
    conversationId: string,
    parentId: string,
  ): Promise<void> {
    const session = await this.prisma.client.conversationSession.findUnique({
      where: { id: conversationId },
    });
    if (!session || session.childId !== childId) {
      throw new NotFoundException('Conversation was not found');
    }

    await this.prisma.client.$transaction([
      this.prisma.client.conversationTurn.deleteMany({
        where: { conversationSessionId: conversationId },
      }),
      this.prisma.client.agentToolCall.deleteMany({
        where: { conversationSessionId: conversationId },
      }),
      this.prisma.client.conversationSession.update({
        where: { id: conversationId },
        data: {
          status: 'cancelled',
          sessionSummary: null,
          endedAt: new Date(),
        },
      }),
      this.prisma.client.privacyConsent.create({
        data: {
          parentUserId: parentId,
          childId,
          consentType: 'audit_delete_conversation',
          version: '1',
          metadataJson: { conversationId, action: 'delete_conversation' },
        },
      }),
    ]);
  }

  async deleteAllHistory(childId: string, parentId: string): Promise<void> {
    const sessions = await this.prisma.client.conversationSession.findMany({
      where: { childId, status: { not: 'cancelled' } },
      select: { id: true },
    });

    for (const session of sessions) {
      await this.deleteConversation(childId, session.id, parentId);
    }
  }

  async deleteAllMemory(childId: string, parentId: string): Promise<void> {
    const items = await this.prisma.client.memoryItem.findMany({
      where: { childId, status: { not: 'deleted' } },
    });

    for (const item of items) {
      await this.prisma.client.memoryItem.update({
        where: { id: item.id },
        data: {
          status: 'deleted',
          deletedAt: new Date(),
          versions: {
            create: {
              previousFact: item.fact,
              newFact: item.fact,
              changedBy: 'parent',
              changedByUserId: parentId,
              reason: 'bulk_delete',
            },
          },
        },
      });
    }

    await this.prisma.client.privacyConsent.create({
      data: {
        parentUserId: parentId,
        childId,
        consentType: 'audit_delete_all_memory',
        version: '1',
        metadataJson: { action: 'delete_all_memory', count: items.length },
      },
    });
  }

  async exportChildData(childId: string, parentId: string): Promise<ChildDataExportDto> {
    const child = await this.prisma.client.childProfile.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException('Child profile was not found');

    const [conversations, memory, safetyEvents, consents] = await Promise.all([
      this.prisma.client.conversationSession.findMany({
        where: { childId, status: { not: 'cancelled' } },
        include: { _count: { select: { turns: true } } },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.client.memoryItem.findMany({
        where: { childId, status: { not: 'deleted' }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.client.safetyEvent.findMany({
        where: { childId, parentVisible: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.client.privacyConsent.findMany({
        where: { childId, parentUserId: parentId },
        orderBy: { grantedAt: 'asc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      child: {
        id: child.id,
        displayName: child.displayName,
        avatarKey: child.avatarKey,
        birthYear: child.birthYear,
        primaryLanguage: child.primaryLanguage,
        readingLevel: child.readingLevel,
        mathLevel: child.mathLevel,
        createdAt: child.createdAt.toISOString(),
      },
      conversations: conversations.map((c) => ({
        id: c.id,
        startedAt: c.startedAt.toISOString(),
        endedAt: c.endedAt?.toISOString() ?? null,
        sessionSummary: c.sessionSummary,
        turnCount: c._count.turns,
      })),
      memory: memory.map((m) => ({
        id: m.id,
        category: m.category,
        fact: m.fact,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
      safetyEvents: safetyEvents.map((e) => ({
        id: e.id,
        childId: e.childId,
        conversationSessionId: e.conversationSessionId,
        turnId: e.turnId,
        category: e.category,
        severity: e.severity,
        detectedBy: e.detectedBy,
        inputExcerpt: e.inputExcerpt,
        actionTaken: e.actionTaken,
        parentVisible: e.parentVisible,
        createdAt: e.createdAt.toISOString(),
      })),
      consents: consents
        .filter((c) =>
          ['audio_recording', 'transcript_retention', 'data_processing'].includes(c.consentType),
        )
        .map((c) => ({
          id: c.id,
          childId: c.childId,
          consentType: c.consentType as ChildDataExportDto['consents'][number]['consentType'],
          version: c.version,
          grantedAt: c.grantedAt.toISOString(),
          revokedAt: c.revokedAt?.toISOString() ?? null,
          metadata:
            c.metadataJson && typeof c.metadataJson === 'object' && !Array.isArray(c.metadataJson)
              ? (c.metadataJson as Record<string, unknown>)
              : {},
        })),
    };
  }

  async revokeActiveSessions(childId: string, parentId: string): Promise<{ revokedCount: number }> {
    const result = await this.prisma.client.gameSession.updateMany({
      where: {
        childId,
        createdByParentId: parentId,
        status: { in: ['pending', 'active'] },
        revokedAt: null,
      },
      data: { status: 'revoked', revokedAt: new Date() },
    });

    await this.prisma.client.privacyConsent.create({
      data: {
        parentUserId: parentId,
        childId,
        consentType: 'audit_revoke_sessions',
        version: '1',
        metadataJson: { action: 'revoke_sessions', count: result.count },
      },
    });

    return { revokedCount: result.count };
  }

  private async getActiveConsent(childId: string, parentId: string, consentType: string) {
    return this.prisma.client.privacyConsent.findFirst({
      where: { childId, parentUserId: parentId, consentType, revokedAt: null },
      orderBy: { grantedAt: 'desc' },
    });
  }

  private async grantConsent(
    childId: string,
    parentId: string,
    consentType: string,
    version: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const active = await this.getActiveConsent(childId, parentId, consentType);
    if (active) return;

    await this.prisma.client.privacyConsent.create({
      data: {
        parentUserId: parentId,
        childId,
        consentType,
        version,
        metadataJson: metadata as object,
      },
    });
  }

  private async revokeConsent(
    childId: string,
    parentId: string,
    consentType: string,
  ): Promise<void> {
    const active = await this.getActiveConsent(childId, parentId, consentType);
    if (!active) return;

    await this.prisma.client.privacyConsent.update({
      where: { id: active.id },
      data: { revokedAt: new Date() },
    });
  }
}
