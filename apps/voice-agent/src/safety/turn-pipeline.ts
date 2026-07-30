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
    const check = hooks.sessionLimits.checkBeforeTurn({
      childId: input.context.childId,
      usage: hooks.sessionUsage,
      concurrentSessionsForChild: 1,
      childDailyCostUsd: 0,
      globalDailyCostUsd: 0,
    });
    if (!check.allowed) {
      return {
        proceed: false,
        userText: input.userText,
        refusalLine: 'Давай сделаем паузу и продолжим чуть позже.',
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
    const assembled = hooks.promptAssembler.assemble({
      safetyPolicy: hooks.safetyPolicy,
      soulText: hooks.soulText,
      ageBand: input.context.ageBand,
      primaryLanguage: input.context.primaryLanguage,
      roleDescription:
        hooks.roleDescription ??
        'You are Pamagochi, a warm voice companion in a child adventure game.',
      childProfile: { displayName: input.context.displayName },
      relationship: memoryContext?.relationship ?? undefined,
      approvedMemory: memoryContext?.memoryItems,
      previousSummary: memoryContext?.previousSummary ?? undefined,
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
