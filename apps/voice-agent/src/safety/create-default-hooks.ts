import { BudgetTracker } from '@pamagochi/agent-core';
import { DEFAULT_SAFETY_POLICY } from '@pamagochi/safety-contracts';
import type { VoiceAgentEnv } from '../config/env.schema.js';
import { PromptAssembler } from '../prompt/prompt-assembler.js';
import { formatSoulForPrompt, SoulLoader } from '../soul/soul-loader.js';
import { InputSafety } from './input-safety.js';
import { OutputSafety } from './output-safety.js';
import {
  SessionLimits,
  createInitialUsage,
  sessionLimitConfigFromEnv,
  type SessionUsage,
} from './session-limits.js';
import type { AgentSafetyHooks } from './turn-pipeline.js';

export interface DefaultSafetyRuntime {
  hooks: AgentSafetyHooks;
  sessionUsage: SessionUsage;
  budgetTracker: BudgetTracker;
  sessionLimits: SessionLimits;
}

/**
 * Production wiring for E2/E5/E6: SOUL + safety + limits + budgets.
 */
export function createDefaultSafetyRuntime(env: VoiceAgentEnv): DefaultSafetyRuntime {
  const soulText = formatSoulForPrompt(
    new SoulLoader().load({ expectedVersion: env.PAMAGOCHI_SOUL_VERSION }).document,
  );
  const sessionLimits = new SessionLimits(sessionLimitConfigFromEnv(env));
  const sessionUsage = createInitialUsage();
  const budgetTracker = new BudgetTracker({
    dailyUsdPerChild: Number(process.env.VOICE_DAILY_BUDGET_USD_PER_CHILD ?? 1),
    globalDailyUsd: Number(process.env.VOICE_GLOBAL_DAILY_BUDGET_USD ?? 25),
  });

  const hooks: AgentSafetyHooks = {
    promptAssembler: new PromptAssembler(),
    safetyPolicy: DEFAULT_SAFETY_POLICY,
    soulText,
    inputSafety: new InputSafety(),
    outputSafety: new OutputSafety(),
    sessionLimits,
    sessionUsage,
    budgetTracker,
    getChildDailyCostUsd: (childId) => budgetTracker.getChildSpend(childId),
    getGlobalDailyCostUsd: () => budgetTracker.getGlobalSpend(),
  };

  return { hooks, sessionUsage, budgetTracker, sessionLimits };
}
