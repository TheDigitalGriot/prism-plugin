import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    outDir: "build",
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      output: {
        // Single chunk — keeps bundling simple for Electron renderer
        inlineDynamicImports: true,
        entryFileNames: "assets/main.js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },

  server: {
    port: 5174,
    strictPort: false,
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@prism-ui": resolve(__dirname, "../../../packages/prism-ui/src"),
    },
  },

  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
})
