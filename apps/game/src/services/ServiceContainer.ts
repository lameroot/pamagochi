import type { GameBridge } from '../bridge/GameBridge.js';
import type { GameRuntimeConfig } from '../config/runtime-config.js';
import { AccessibilityManager } from '../systems/AccessibilityManager.js';

export interface GameServices {
  runtime: GameRuntimeConfig;
  bridge: GameBridge;
  accessibility: AccessibilityManager;
}

/** Composition root: scenes only receive typed local services, never env or HTTP clients. */
export class ServiceContainer implements GameServices {
  readonly runtime: GameRuntimeConfig;
  readonly bridge: GameBridge;
  readonly accessibility: AccessibilityManager;

  constructor(services: GameServices) {
    this.runtime = services.runtime;
    this.bridge = services.bridge;
    this.accessibility = services.accessibility;
  }
}
