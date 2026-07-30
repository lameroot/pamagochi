import type { BudgetTracker } from '@pamagochi/agent-core';
import type { AgentToolName, VoiceSessionContext } from '@pamagochi/contracts';
import type { SafetyPolicyDocument } from '@pamagochi/safety-contracts';
import type { PromptAssembler } from '../prompt/prompt-assembler.js';
import type { InputSafety } from '../safety/input-safety.js';
import type { OutputSafety } from '../safety/output-safety.js';
import type { SessionLimits, SessionUsage } from '../safety/session-limits.js';

/** Optional E2 hooks — wired when PromptAssembler / safety modules are configured. */
export interface AgentSafetyHooks {
  promptAssembler?: PromptAssembler;
  safetyPolicy?: SafetyPolicyDocument;
  soulText?: string;
  inputSafety?: InputSafety;
  outputSafety?: OutputSafety;
  sessionLimits?: SessionLimits;
  sessionUsage?: SessionUsage;
  allowedTools?: AgentToolName[];
  roleDescription?: string;
  onSafetyEvent?: (event: unknown) => void | Promise<void>;
  budgetTracker?: BudgetTracker;
  getChildDailyCostUsd?: (childId: string) => number;
  getGlobalDailyCostUsd?: () => number;
  concurrentSessionsForChild?: number;
}

export interface TurnPipelineContext {
  context: VoiceSessionContext;
  userText: string;
  turnId?: string;
}

export interface TurnPipelineResult {
  proceed: boolean;
  userText: string;
  systemPrompt?: string;
  refusalLine?: string;
}

/**
 * Runs optional input safety + session limits + prompt assembly before LLM.
 */
export async function runInputPipeline(
  hooks: AgentSafetyHooks | undefined,
  input: TurnPipelineContext,
): Promise<TurnPipelineResult> {
  if (!hooks) {
    return { proceed: true, userText: input.userText };
  }

  if (hooks.sessionLimits && hooks.sessionUsage) {
    const childDailyCostUsd =
      hooks.getChildDailyCostUsd?.(input.context.childId) ??
      hooks.budgetTracker?.getChildSpend(input.context.childId) ??
      hooks.sessionUsage.estimatedCostUsd;
    const globalDailyCostUsd =
      hooks.getGlobalDailyCostUsd?.() ?? hooks.budgetTracker?.getGlobalSpend() ?? 0;
    const check = hooks.sessionLimits.checkBeforeTurn({
      childId: input.context.childId,
      usage: hooks.sessionUsage,
      concurrentSessionsForChild: hooks.concurrentSessionsForChild ?? 1,
      childDailyCostUsd,
      globalDailyCostUsd,
    });
    if (!check.allowed) {
      return {
        proceed: false,
        userText: input.userText,
        refusalLine: check.message ?? 'Давай сделаем паузу и продолжим чуть позже.',
      };
    }
  }

  if (hooks.inputSafety) {
    const result = hooks.inputSafety.evaluate(input.userText, {
      childId: input.context.childId,
      conversationSessionId: input.context.conversationSessionId,
      turnId: input.turnId ?? null,
    });
    if (!result.allowed) {
      if (result.safetyEvent && hooks.onSafetyEvent) {
        await hooks.onSafetyEvent(result.safetyEvent);
      }
      return {
        proceed: false,
        userText: input.userText,
        refusalLine: result.refusalLine ?? undefined,
      };
    }
  }

  let systemPrompt: string | undefined;
  if (hooks.promptAssembler && hooks.safetyPolicy && hooks.soulText) {
    const memoryContext = input.context.memoryContext;
    const worldState = input.context.worldState;
    const assembled = hooks.promptAssembler.assemble({
      safetyPolicy: hooks.safetyPolicy,
      soulText: hooks.soulText,
      ageBand: input.context.ageBand,
      primaryLanguage: input.context.primaryLanguage,
      roleDescription:
        input.context.goal ??
        hooks.roleDescription ??
        'You are Pamagochi, a warm voice companion in a child adventure game.',
      childProfile: { displayName: input.context.displayName },
      relationship: memoryContext?.relationship ?? undefined,
      approvedMemory: memoryContext?.memoryItems,
      previousSummary: memoryContext?.previousSummary ?? undefined,
      worldState: worldState ?? undefined,
      goal: input.context.goal ?? undefined,
      allowedTools: hooks.allowedTools ?? ['character_emote'],
    });
    systemPrompt = assembled.systemPrompt;
  }

  return { proceed: true, userText: input.userText, systemPrompt };
}

export async function runOutputPipeline(
  hooks: AgentSafetyHooks | undefined,
  input: TurnPipelineContext & { agentText: string },
): Promise<string> {
  if (!hooks?.outputSafety) return input.agentText;

  const result = hooks.outputSafety.evaluate(input.agentText, {
    childId: input.context.childId,
    conversationSessionId: input.context.conversationSessionId,
    turnId: input.turnId ?? null,
    ageBand: input.context.ageBand,
  });

  if (result.safetyEvent && hooks.onSafetyEvent) {
    await hooks.onSafetyEvent(result.safetyEvent);
  }

  return result.text;
}
