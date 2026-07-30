import { DEFAULT_USAGE_RATES, type UsageTotals } from './budget.js';

export interface SessionUsageCosts {
  inputTokens: number;
  outputTokens: number;
  ttsChars: number;
  sttSeconds: number;
  estimatedCostUsd: number;
}

export function aggregateSessionCosts(
  sessions: Array<{
    costInputTokens: number;
    costOutputTokens: number;
    costTtsChars: number;
    costSttSeconds: number;
  }>,
): SessionUsageCosts {
  const totals = sessions.reduce<UsageTotals>(
    (acc, s) => ({
      inputTokens: acc.inputTokens + s.costInputTokens,
      outputTokens: acc.outputTokens + s.costOutputTokens,
      ttsChars: acc.ttsChars + s.costTtsChars,
      sttSeconds: acc.sttSeconds + s.costSttSeconds,
    }),
    { inputTokens: 0, outputTokens: 0, ttsChars: 0, sttSeconds: 0 },
  );

  const estimatedCostUsd =
    totals.inputTokens * DEFAULT_USAGE_RATES.inputTokenUsd +
    totals.outputTokens * DEFAULT_USAGE_RATES.outputTokenUsd +
    totals.ttsChars * DEFAULT_USAGE_RATES.ttsCharUsd +
    totals.sttSeconds * DEFAULT_USAGE_RATES.sttSecondUsd;

  return { ...totals, estimatedCostUsd };
}
