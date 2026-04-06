import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import type { Plugin, ViteDevServer } from 'vite'
import path from 'path'

/** Write the dev server port to a file so the extension host can read it. */
const writePortPlugin = (): Plugin => ({
  name: 'write-port',
  configureServer(server: ViteDevServer) {
    server.httpServer?.once('listening', () => {
      const address = server.httpServer?.address()
      if (address && typeof address === 'object' && address.port) {
        writeFileSync('.vite-panel-port', String(address.port))
        console.log(`[Prism Panel] Vite dev server on port ${address.port}`)
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), writePortPlugin()],
  resolve: {
    alias: {
      '@prism-ui': path.resolve(__dirname, '../../../packages/prism-ui/src'),
      // Pin React to local copy to prevent workspace hoisting mismatches.
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  build: {
    outDir: '../dist/webview-panel',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  base: './',
  server: {
    port: 5175,
    strictPort: false,
  },
})
