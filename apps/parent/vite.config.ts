import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.PARENT_PORT ?? 5175);

  return {
    plugins: [react()],
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
    build: { outDir: 'dist', sourcemap: true },
  };
});
