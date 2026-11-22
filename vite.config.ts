import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isEnvTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const disableHmr = isEnvTruthy(env.DISABLE_HMR ?? process.env.DISABLE_HMR);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Explicitly disabling ws alongside hmr prevents standalone WS binding in middleware mode.
      hmr: disableHmr ? false : true,
      ws: disableHmr ? false : undefined,
      // Disable file watching when DISABLE_HMR is true to save CPU and prevent restart loops during edits.
      watch: disableHmr
        ? null
        : {
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.aistudio/**'],
          },
    },
    build: {
      target: 'es2022',
      minify: 'terser',
      terserOptions: {
        compress: {
          passes: 2,
          drop_debugger: true,
        },
        format: {
          comments: false,
        },
      },
      sourcemap: mode === 'production' ? 'hidden' : true,
      cssCodeSplit: true,
      reportCompressedSize: true,
    },
  };
});
