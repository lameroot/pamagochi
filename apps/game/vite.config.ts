import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.GAME_PORT ?? 5174);
  const modeDefaults: Record<string, Record<string, string>> = {
    game: { VITE_GAME_RUNTIME: 'mock' },
    'game-voice': { VITE_GAME_RUNTIME: 'local' },
    'game-hatching': { VITE_GAME_RUNTIME: 'mock', VITE_GAME_START_SCENE: 'HatchingScene' },
    'game-room': { VITE_GAME_RUNTIME: 'mock', VITE_GAME_START_SCENE: 'CapsuleRoomScene' },
  };
  const gameEnv = modeDefaults[mode] ?? {};

  return {
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: { outDir: 'dist', sourcemap: true },
    define: Object.fromEntries(
      Object.entries(gameEnv).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
  };
});
