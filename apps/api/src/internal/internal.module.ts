import { Module, OnModuleInit } from '@nestjs/common';
import { AgentConversationService } from './agent-conversation.service.js';
import { InternalAgentController } from './internal-agent.controller.js';
import { MemoryContextService } from './memory-context.service.js';
import { PromptVersionService } from './prompt-version.service.js';
import { SafetyEventService } from './safety-event.service.js';
import { SESSION_FINALIZE_JOB, SessionFinalizeService } from './session-finalize.service.js';
import { ServiceAuthGuard } from './service-auth.guard.js';
import { SessionLimitService } from './session-limit.service.js';
import { sessionLimitConfigFromApiEnv } from './session-limit-config.js';
import { ToolValidationService } from './tool-validation.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { InlineJobDispatcher } from '../jobs/inline-job-dispatcher.js';

@Module({
  controllers: [InternalAgentController],
  providers: [
    ServiceAuthGuard,
    AgentConversationService,
    ToolValidationService,
    PromptVersionService,
    SafetyEventService,
    MemoryContextService,
    SessionFinalizeService,
    {
      provide: SessionLimitService,
      useFactory: (config: AppConfigService) =>
        new SessionLimitService(
          sessionLimitConfigFromApiEnv({
            VOICE_SESSION_MAX_DURATION_SECONDS: config.voiceSessionMaxDurationSeconds,
            VOICE_SESSION_IDLE_TIMEOUT_SECONDS: config.voiceSessionIdleTimeoutSeconds,
            VOICE_MAX_CONCURRENT_SESSIONS_PER_CHILD: config.voiceMaxConcurrentSessionsPerChild,
            VOICE_DAILY_BUDGET_USD_PER_CHILD: config.voiceDailyBudgetUsdPerChild,
            VOICE_GLOBAL_DAILY_BUDGET_USD: config.voiceGlobalDailyBudgetUsd,
          }),
        ),
      inject: [AppConfigService],
    },
  ],
  exports: [
    PromptVersionService,
    SessionLimitService,
    ToolValidationService,
    SafetyEventService,
    MemoryContextService,
  ],
})
export class InternalModule implements OnModuleInit {
  constructor(
    private readonly jobs: InlineJobDispatcher,
    private readonly finalize: SessionFinalizeService,
  ) {}

  onModuleInit(): void {
    this.jobs.registerHandler(SESSION_FINALIZE_JOB, (payload) =>
      this.finalize.run(payload as { conversationSessionId: string }),
    );
  }
}
