import { describe, expect, it } from 'vitest';
import { ChildUsageService } from './child-usage.service.js';

describe('ChildUsageService (E6.5)', () => {
  it('aggregates daily session costs for a child', async () => {
    const prisma = {
      client: {
        conversationSession: {
          findMany: async () => [
            {
              costInputTokens: 100,
              costOutputTokens: 200,
              costTtsChars: 50,
              costSttSeconds: 10,
            },
            {
              costInputTokens: 50,
              costOutputTokens: 100,
              costTtsChars: 25,
              costSttSeconds: 5,
            },
          ],
        },
      },
    };

    const service = new ChildUsageService(prisma as never);
    const summary = await service.getDailySummary('child-1');

    expect(summary.childId).toBe('child-1');
    expect(summary.sessionCount).toBe(2);
    expect(summary.totals.inputTokens).toBe(150);
    expect(summary.totals.outputTokens).toBe(300);
    expect(summary.totals.estimatedCostUsd).toBeGreaterThan(0);
  });
});
