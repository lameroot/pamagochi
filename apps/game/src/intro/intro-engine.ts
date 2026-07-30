import type { IntroProgressDto } from '@pamagochi/contracts';
import type { IntroState } from '@pamagochi/game-protocol';
import {
  applyIntroTransition,
  evaluateSceneEventRequest,
  introAllowlistFor,
} from '@pamagochi/game-protocol';
import type { IntroProgressClient } from './intro-progress-client.js';

export type IntroEngineListener = (state: IntroState, progress: IntroProgressDto) => void;

export interface IntroEngineOptions {
  initialProgress: IntroProgressDto;
  client: IntroProgressClient;
  onStateChange?: IntroEngineListener;
}

/**
 * Deterministic intro controller for Phaser — transitions are validated locally
 * and persisted through the API (idempotent).
 */
export class IntroEngine {
  private state: IntroState;
  private progress: IntroProgressDto;
  private readonly listeners = new Set<IntroEngineListener>();

  constructor(private readonly options: IntroEngineOptions) {
    this.state = options.initialProgress.state;
    this.progress = options.initialProgress;
  }

  getState(): IntroState {
    return this.state;
  }

  getProgress(): IntroProgressDto {
    return this.progress;
  }

  getAllowlist() {
    return introAllowlistFor(this.state);
  }

  onStateChange(listener: IntroEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Player-driven transition (console, power cell, etc.). */
  async advanceTo(
    target: IntroState,
    meta?: { idempotencyKey?: string; sharedEvent?: string },
  ): Promise<boolean> {
    const local = applyIntroTransition(this.state, target);
    if (!local.ok) return false;

    if (!local.changed) return true;

    const idempotencyKey = meta?.idempotencyKey ?? `player-${this.state}-${target}-${Date.now()}`;
    try {
      const result = await this.options.client.transition({
        targetState: target,
        idempotencyKey,
        sharedEvent: meta?.sharedEvent,
      });
      this.applyProgress(result.progress);
      return result.changed;
    } catch {
      return false;
    }
  }

  /**
   * Handles validated `scene_event_request` payloads from the voice bridge.
   * Returns false when the game rejects the request (e.g. OPEN_CAPSULE without power).
   */
  async handleSceneEventRequest(eventId: string, callId: string): Promise<boolean> {
    const decision = evaluateSceneEventRequest(this.state, eventId);
    if (!decision.accepted) return false;

    return this.advanceTo(decision.nextState, {
      idempotencyKey: `event-${callId}`,
      sharedEvent: decision.eventId,
    });
  }

  private applyProgress(progress: IntroProgressDto): void {
    const prev = this.state;
    this.progress = progress;
    this.state = progress.state;
    if (prev !== this.state) {
      for (const listener of this.listeners) listener(this.state, this.progress);
      this.options.onStateChange?.(this.state, this.progress);
    }
  }
}
