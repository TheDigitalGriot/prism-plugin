import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The renderer SPA lives in webview-ui/. We keep the default root (project dir)
// so the Forge Vite plugin outputs to .vite/renderer/ at project root, which
// gets packaged into the ASAR correctly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'webview-ui/src'),
      '@prism-ui': path.resolve(__dirname, '../../packages/prism-ui/src'),
    },
  },
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'webview-ui/index.html'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
});
