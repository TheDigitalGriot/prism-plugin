import { defineConfig, Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves @prism-core/* by trying packages/prism-core/src first,
 * then falling back to cmd/prism-vscode/src for files not yet migrated.
 */
function prismCoreAliasPlugin(): Plugin {
  const prismCorePath = path.resolve(__dirname, '../../packages/prism-core/src');
  const prismVscodePath = path.resolve(__dirname, '../prism-vscode/src');

  return {
    name: 'prism-core-alias',
    resolveId(id: string) {
      if (!id.startsWith('@prism-core/')) return null;
      const subpath = id.slice('@prism-core/'.length);
      const extensions = ['', '.ts', '/index.ts'];
      for (const base of [prismCorePath, prismVscodePath]) {
        for (const ext of extensions) {
          const candidate = path.resolve(base, subpath + ext);
          if (fs.existsSync(candidate)) {
            // Normalize to forward slashes so Vite/Rollup deduplicates this
            // module with relative imports resolved inside the same package.
            // On Windows, path.resolve() returns backslashes, but Vite uses
            // forward slashes internally — mismatched IDs create two separate
            // module instances with separate global Maps (the grpc-handler
            // singleton registries), causing "Unknown handler" errors.
            return candidate.replace(/\\/g, '/');
          }
        }
      }
      return null;
    },
  };
}

// https://vitejs.dev/config
export default defineConfig({
  plugins: [prismCoreAliasPlugin()],
});
