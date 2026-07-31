import Phaser from 'phaser';
import { createGameConfig } from './config/game-config.js';
import { getGameRuntimeConfig } from './config/runtime-config.js';
import { GameBridge } from './bridge/GameBridge.js';
import { ServiceContainer } from './services/ServiceContainer.js';
import { AccessibilityManager } from './systems/AccessibilityManager.js';
import { ArrivalScene } from './scenes/ArrivalScene.js';
import { BootScene } from './scenes/BootScene.js';
import { CapsuleRoomScene } from './scenes/CapsuleRoomScene.js';
import { GameHudScene } from './scenes/GameHudScene.js';
import { DevToolsScene } from './scenes/DevToolsScene.js';
import { HatchingScene } from './scenes/HatchingScene.js';
import { PreloaderScene } from './scenes/PreloaderScene.js';
import { ShipCapsuleScene } from './scenes/ShipCapsuleScene.js';
import { TalkingLightScene } from './scenes/TalkingLightScene.js';

export function createGame(parent: HTMLElement): Phaser.Game {
  const runtime = getGameRuntimeConfig();
  const bridge = new GameBridge();
  const services = new ServiceContainer({
    runtime,
    bridge,
    accessibility: new AccessibilityManager(),
  });

  return new Phaser.Game(
    createGameConfig({
      parent,
      runtime,
      bridge,
      services,
      scenes: [
        BootScene,
        PreloaderScene,
        ArrivalScene,
        HatchingScene,
        CapsuleRoomScene,
        GameHudScene,
        ...(import.meta.env.DEV ? [DevToolsScene] : []),
        // Legacy voice scenes remain registered for `pnpm game:voice`.
        ShipCapsuleScene,
        TalkingLightScene,
      ],
    }),
  );
}

export { resolveStartScene } from './config/runtime-config.js';
