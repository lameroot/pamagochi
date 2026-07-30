import { Module } from '@nestjs/common';
import { AgentConversationService } from './agent-conversation.service.js';
import { InternalAgentController } from './internal-agent.controller.js';
import { PromptVersionService } from './prompt-version.service.js';
import { ServiceAuthGuard } from './service-auth.guard.js';
import { SessionLimitService } from './session-limit.service.js';
import { sessionLimitConfigFromApiEnv } from './session-limit-config.js';
import { ToolValidationService } from './tool-validation.service.js';
import { AppConfigService } from '../config/app-config.service.js';

@Module({
  controllers: [InternalAgentController],
  providers: [
    ServiceAuthGuard,
    AgentConversationService,
    ToolValidationService,
    PromptVersionService,
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
  exports: [PromptVersionService, SessionLimitService, ToolValidationService],
})
export class InternalModule {}
