# Game development

## Quick start

```bash
pnpm game              # mock runtime, ArrivalScene
pnpm game:hatching     # direct HatchingScene
pnpm game:room         # direct CapsuleRoomScene
pnpm game:voice        # existing LiveKit/API flow
pnpm check
```

`game`, `game:hatching` and `game:room` never require a network connection. Runtime mode is defined in `apps/game/src/config/runtime-config.ts`; scenes receive only the typed service container (`GameBridge`, accessibility settings and runtime configuration).

## Runtime architecture

`apps/game/src/createGame.ts` registers scenes. `BootScene` and `PreloaderScene` load local assets, `ArrivalScene` leads to `HatchingScene`, then `CapsuleRoomScene`; `GameHudScene` is an overlay. A scene emits UI-safe events through `apps/game/src/bridge/GameBridge.ts`; it must not call HTTP, LiveKit or an LLM directly. Dialogue providers and progress repositories live under `apps/game/src/adapters/`; the mock provider is the default for the slice.

Game rules and transition validation stay in `packages/game-core` and `apps/game/src/systems/PetStateMachine.ts`; no Phaser/browser imports belong in game-core.

## Add gameplay

1. Add a local asset and its key to `apps/game/public/assets/pack.json` and preload it in `apps/game/src/scenes/PreloaderScene.ts`.
2. Add an `InteractiveObjectDefinition` and a typed mock dialogue response in `apps/game/src/data/mock-dialogues.ts`.
3. Validate any returned `PetAction` with `GameActionExecutor`; never execute model text as code.
4. Add a state to `PetStateMachine` with explicit allowed transitions and tests.

## Phaser Editor v5

Open `/Users/lameroot/IdeaProjects/github/pamagochi/apps/game` as the Editor project, then open `public/assets/pack.json`. It is an Asset Pack because its `meta.contentType` is `phasereditor2d.pack.core.AssetContentType`. The MCP bridge can now discover it.

The current Editor sources and generated output live together at the `apps/game/` project root: `CapsuleRoomLayout.scene`/`.js` plus the `Pamagochi`, `Egg`, `InteractiveObject`, `CapsuleConsole`, `CapsuleDoor`, `Window` and `StorageContainer` prefabs. Generated `.js` files are output only: do not hand-edit them. Keep runtime behaviour in `src/scenes`, `src/entities` and `src/systems`. After an MCP scene edit, use Editor Save to regenerate its matching `.js`, then import/register it in `createGame.ts` only when it becomes the runtime scene.

## Dev panel

In development builds press **F2**. It is omitted from production registration. The panel can switch/restart scenes, finish arrival/hatching, preview pet states, trigger a mock action, teleport, display navigation zones/FPS, toggle settings, change tween speed, clear local progress and copy a compact state snapshot. It is diagnostic-only and must not be used as gameplay API.

## Assets and licences

Only project-owned SVG assets are currently used. Record every external asset before adding it in `apps/game/public/assets/licenses/README.md` and `apps/game/public/assets/licenses/THIRD_PARTY_ASSETS.md`: name, author, source, licence, download date, path and modifications.
