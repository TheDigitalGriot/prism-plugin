import * as esbuild from "esbuild"
import { existsSync, mkdirSync } from "fs"

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
}

async function main() {
  if (watch) {
    const ctx = await esbuild.context(extensionConfig)
    await ctx.watch()
    console.log("[watch] watching for changes...")
  } else {
    await esbuild.build(extensionConfig)
    console.log("Build complete!")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
