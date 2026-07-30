import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  type ChildDataExportDto,
  type ChildPrivacySettingsDto,
  updateChildPrivacySettingsRequestSchema,
} from '@pamagochi/contracts';
import type { ParentAccount } from '@pamagochi/database';
import { AuthGuard } from '../auth/auth.guard.js';
import { ParentApiRateLimitGuard } from '../common/rate-limit.guard.js';
import { CurrentParent } from '../auth/current-parent.decorator.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ChildOwnershipService } from '../profiles/child-ownership.service.js';
import { ParentPrivacyService } from './parent-privacy.service.js';

@Controller('api/children/:childId/privacy')
@UseGuards(AuthGuard, ParentApiRateLimitGuard)
export class ParentPrivacyController {
  constructor(
    private readonly ownership: ChildOwnershipService,
    private readonly privacy: ParentPrivacyService,
    private readonly config: AppConfigService,
  ) {}

  @Get('settings')
  async getSettings(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildPrivacySettingsDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    return this.privacy.getSettings(childId, parent.id);
  }

  @Patch('settings')
  async updateSettings(
    @Param('childId') childId: string,
    @Body() body: unknown,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildPrivacySettingsDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    const parsed = updateChildPrivacySettingsRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message).join('; '));
    }
    if (parsed.data.audioRecordingConsent === true && !this.config.audioRecordingEnabled) {
      throw new BadRequestException('Audio recording is not permitted by server configuration');
    }
    return this.privacy.updateSettings(childId, parent.id, parsed.data);
  }

  @Post('delete-conversation/:conversationId')
  async deleteConversation(
    @Param('childId') childId: string,
    @Param('conversationId') conversationId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<{ ok: true }> {
    await this.ownership.requireOwnedChild(childId, parent);
    await this.privacy.deleteConversation(childId, conversationId, parent.id);
    return { ok: true };
  }

  @Post('delete-all-history')
  async deleteAllHistory(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<{ ok: true }> {
    await this.ownership.requireOwnedChild(childId, parent);
    await this.privacy.deleteAllHistory(childId, parent.id);
    return { ok: true };
  }

  @Post('delete-all-memory')
  async deleteAllMemory(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<{ ok: true }> {
    await this.ownership.requireOwnedChild(childId, parent);
    await this.privacy.deleteAllMemory(childId, parent.id);
    return { ok: true };
  }

  @Get('export')
  async exportData(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<ChildDataExportDto> {
    await this.ownership.requireOwnedChild(childId, parent);
    return this.privacy.exportChildData(childId, parent.id);
  }

  @Post('revoke-sessions')
  async revokeSessions(
    @Param('childId') childId: string,
    @CurrentParent() parent: ParentAccount,
  ): Promise<{ revokedCount: number }> {
    await this.ownership.requireOwnedChild(childId, parent);
    return this.privacy.revokeActiveSessions(childId, parent.id);
  }
}
