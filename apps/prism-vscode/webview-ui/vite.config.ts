import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"
import { writeFileSync, existsSync, mkdirSync } from "fs"
import type { Plugin, ViteDevServer } from "vite"

/** Write the dev server port to a file so the extension host can read it. */
const writePortPlugin = (): Plugin => ({
  name: "write-port",
  configureServer(server: ViteDevServer) {
    server.httpServer?.once("listening", () => {
      const address = server.httpServer?.address()
      if (address && typeof address === "object" && address.port) {
        writeFileSync(".vite-port", String(address.port))
        console.log(`[Prism] Vite dev server on port ${address.port}`)
      }
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), writePortPlugin()],

  build: {
    outDir: "build",
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      output: {
        // Single chunk — required for VS Code webview (no dynamic imports)
        inlineDynamicImports: true,
        entryFileNames: "assets/main.js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },

  server: {
    port: 5173,
    strictPort: false,
    hmr: {
      host: "localhost",
      protocol: "ws",
    },
    cors: {
      origin: "*",
      methods: "*",
      allowedHeaders: "*",
    },
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@prism-ui": resolve(__dirname, "../../../packages/prism-ui/src"),
      // Pin to local React 18 — prevents @prism-ui from resolving
      // React 19 from root node_modules (npm workspace hoisting).
      "react": resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
    },
  },

  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
})
