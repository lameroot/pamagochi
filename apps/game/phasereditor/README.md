# Phaser Editor workspace

Open **`apps/game`** as an existing project in Phaser Editor. The Vite application remains the source of runtime configuration; do not create a second Phaser application.

## Assets

Open `public/assets/pack.json` in Asset Pack Editor. It exposes the same SVG keys loaded by `src/scenes/PreloaderScene.ts`.

## Scenes and prefabs

Create editor source files under this directory:

- `phasereditor/scenes/` — editable `.scene` source files.
- `phasereditor/prefabs/` — reusable `.scene` prefabs.

Use the Scene Editor compiler to write generated TypeScript into `src/generated/`. Generated files are disposable output: do not hand-edit them. Runtime systems stay in `src/scenes/`, `src/entities/` and `src/systems/`.

## Required editor objects

Create prefabs named `Pamagochi`, `Egg`, `InteractiveObject`, `CapsuleConsole`, `CapsuleDoor`, `Window` and `StorageContainer`, then place visual instances in `CapsuleRoom.scene`.

Do not move or rename an asset key without updating both `public/assets/pack.json` and `src/scenes/PreloaderScene.ts`.
