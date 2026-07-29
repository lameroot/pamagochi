import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.GAME_PORT ?? 5174);

  return {
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: { outDir: 'dist', sourcemap: true },
  };
});
