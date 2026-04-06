import * as esbuild from "esbuild"
import { existsSync, mkdirSync, cpSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started")
    })
    build.onEnd((result) => {
      if (result.errors.length > 0) {
        result.errors.forEach(({ text, location }) => {
          console.error(`✘ [ERROR] ${text}`)
          if (location) {
            console.error(`    ${location.file}:${location.line}:${location.column}:`)
          }
        })
      } else {
        console.log("[watch] build finished")
      }
    })
  },
}

// Ensure dist directory exists
if (!existsSync("dist")) {
  mkdirSync("dist", { recursive: true })
}

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  format: "cjs",
  platform: "node",
  tsconfig: "tsconfig.json",
  external: ["vscode"],
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  plugins: [esbuildProblemMatcherPlugin],
  define: {
    "process.env.IS_PRODUCTION": production ? '"true"' : '"false"',
  },
  alias: {
    "@prism-core": join(__dirname, "../../packages/prism-core/src"),
  },
}

function copyOfficeAssets() {
  const src = join(__dirname, "assets")
  const dest = join(__dirname, "dist", "assets")
  if (existsSync(src)) {
    mkdirSync(dest, { recursive: true })
    cpSync(src, dest, { recursive: true })
    console.log("Office assets copied to dist/assets/")
  }
}

function copyPanelAssets() {
  const src = join(__dirname, "dist", "webview-panel")
  if (!existsSync(src)) {
    console.log("webview-panel not yet built — skipping copyPanelAssets()")
  }
}

async function main() {
  if (watch) {
    const ctx = await esbuild.context(extensionConfig)
    await ctx.watch()
    console.log("[watch] watching for changes...")
  } else {
    await esbuild.build(extensionConfig)
    copyOfficeAssets()
    copyPanelAssets()
    console.log("Build complete!")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
