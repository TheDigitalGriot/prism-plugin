import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@prism-core': path.resolve(__dirname, '../prism-vscode/src'),
    },
  },
});
