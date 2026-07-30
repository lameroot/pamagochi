import type { IntroProgressDto } from '@pamagochi/contracts';
import {
  introProgressTransitionResponseSchema,
  type IntroProgressTransitionResponse,
} from '@pamagochi/contracts';
import type { IntroState } from '@pamagochi/game-protocol';
import { applyIntroTransition } from '@pamagochi/game-protocol';

export interface IntroProgressClient {
  transition(input: {
    targetState: IntroState;
    idempotencyKey: string;
    sourceEvent?: string;
    sharedEvent?: string;
  }): Promise<IntroProgressTransitionResponse>;
}

export async function createHttpIntroProgressClient(
  limitedGameToken: string,
  apiBaseUrl?: string,
): Promise<IntroProgressClient> {
  const base = (apiBaseUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(
    /\/$/,
    '',
  );

  return {
    async transition(input) {
      const response = await fetch(`${base}/api/game/intro-progress/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          limitedGameToken,
          targetState: input.targetState,
          idempotencyKey: input.idempotencyKey,
          sourceEvent: input.sourceEvent,
          sharedEvent: input.sharedEvent,
        }),
      });
      if (!response.ok) {
        throw new Error('intro_transition_failed');
      }
      const json: unknown = await response.json();
      return introProgressTransitionResponseSchema.parse(json);
    },
  };
}

/** In-memory client for tests — mirrors API idempotency semantics. */
export class MockIntroProgressClient implements IntroProgressClient {
  constructor(private progress: IntroProgressDto) {}

  getProgress(): IntroProgressDto {
    return this.progress;
  }

  async transition(input: {
    targetState: IntroState;
    idempotencyKey: string;
    sourceEvent?: string;
    sharedEvent?: string;
  }): Promise<IntroProgressTransitionResponse> {
    const result = applyIntroTransition(this.progress.state, input.targetState);
    if (!result.ok) {
      throw new Error(result.reason);
    }
    if (!result.changed) {
      return { progress: this.progress, changed: false };
    }
    const sharedEvents = [...this.progress.sharedEvents];
    if (input.sharedEvent && !sharedEvents.includes(input.sharedEvent)) {
      sharedEvents.push(input.sharedEvent);
    }
    this.progress = {
      state: input.targetState,
      sharedEvents,
      completed: input.targetState === 'INTRO_COMPLETED',
      updatedAt: new Date().toISOString(),
    };
    return { progress: this.progress, changed: true };
  }
}
