import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ChildOwnershipService } from '../profiles/child-ownership.service.js';
import { ChildOverviewController } from './child-overview.controller.js';
import { ChildOverviewService } from './child-overview.service.js';
import { MemoryPolicyService } from './memory-policy.service.js';
import { ParentConversationsService } from './parent-conversations.service.js';
import { ParentMemoryController } from './parent-memory.controller.js';
import { ParentMemoryService } from './parent-memory.service.js';
import { ParentPrivacyController } from './parent-privacy.controller.js';
import { ParentPrivacyService } from './parent-privacy.service.js';
import { ParentSafetyController } from './parent-safety.controller.js';
import { ParentSafetyService } from './parent-safety.service.js';
import { PrivacyConsentsController } from './privacy-consents.controller.js';

@Module({
  imports: [AuthModule, DatabaseModule, ConfigModule],
  controllers: [
    ChildOverviewController,
    PrivacyConsentsController,
    ParentMemoryController,
    ParentPrivacyController,
    ParentSafetyController,
  ],
  providers: [
    ChildOwnershipService,
    ChildOverviewService,
    ParentConversationsService,
    ParentMemoryService,
    MemoryPolicyService,
    ParentPrivacyService,
    ParentSafetyService,
  ],
  exports: [ChildOwnershipService, ParentMemoryService],
})
export class ParentCabinetModule {}
