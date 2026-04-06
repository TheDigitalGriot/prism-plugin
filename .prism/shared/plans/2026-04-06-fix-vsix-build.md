# Fix VSIX Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the VSIX build so `npm run check-types`, `build:panel`, `build:webview`, and VSIX packaging all pass cleanly.

**Architecture:** Three root causes: (1) vite.config.ts files in webview-panel and webview-ui pin `react` resolve to local `node_modules/react` which doesn't exist in npm workspace hoisted layout — fix by using `require.resolve` or removing the pin, (2) `@types/vscode` is not installed — add to devDependencies, (3) tree provider files import `vscode` module without types.

**Tech Stack:** TypeScript, Vite, React, npm workspaces, VSCode Extension API.

---

## File Structure

| Action | Path | What Changes |
|--------|------|-------------|
| Modify | `apps/prism-vscode/webview-panel/vite.config.ts` | Fix react resolve to work with hoisted node_modules |
| Modify | `apps/prism-vscode/webview-ui/vite.config.ts` | Same fix |
| Modify | `apps/prism-vscode/package.json` | Add @types/vscode to devDependencies if missing |
| Verify | Full VSIX build pipeline | check-types + build:panel + build:webview + vsce package |

---

### Task 1: Fix Vite React Resolution in webview-panel

**Files:**
- Modify: `apps/prism-vscode/webview-panel/vite.config.ts`

- [ ] **Step 1: Read the current vite.config.ts**

Read `apps/prism-vscode/webview-panel/vite.config.ts` completely.

- [ ] **Step 2: Fix the react resolve alias**

The config currently has something like:
```ts
resolve: {
  alias: {
    react: path.resolve(__dirname, 'node_modules/react'),
    'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  }
}
```

This forces Vite to look for react in the LOCAL node_modules, but npm workspaces hoists react to the root. Fix by using `require.resolve` which traverses the module resolution chain:

```ts
resolve: {
  alias: {
    react: path.dirname(require.resolve('react/package.json')),
    'react-dom': path.dirname(require.resolve('react-dom/package.json')),
  }
}
```

Or alternatively, simply REMOVE the react/react-dom aliases entirely — Vite's default resolution already handles npm workspace hoisting. The alias was likely added to pin a specific React version (webview-panel uses React 19, webview-ui uses React 18), but since each has its own package.json with the correct version, Vite resolves correctly without the pin.

Choose whichever approach is simpler and doesn't break the React 19 vs 18 separation.

- [ ] **Step 3: Verify build**

Run: `cd apps/prism-vscode && npm run build:panel`
Expected: Vite build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/prism-vscode/webview-panel/vite.config.ts
git commit -m "fix: resolve react in webview-panel vite config for npm workspace hoisting"
```

---

### Task 2: Fix Vite React Resolution in webview-ui

**Files:**
- Modify: `apps/prism-vscode/webview-ui/vite.config.ts`

- [ ] **Step 1: Read the current vite.config.ts**

Read `apps/prism-vscode/webview-ui/vite.config.ts` completely.

- [ ] **Step 2: Apply the same fix as Task 1**

Same pattern — fix the react/react-dom resolve alias to use `require.resolve` or remove the hardcoded local path.

- [ ] **Step 3: Verify build**

Run: `cd apps/prism-vscode && npm run build:webview`
Expected: Vite build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/prism-vscode/webview-ui/vite.config.ts
git commit -m "fix: resolve react in webview-ui vite config for npm workspace hoisting"
```

---

### Task 3: Fix TypeScript Type Errors

**Files:**
- Modify: `apps/prism-vscode/package.json` (add @types/vscode if missing)

- [ ] **Step 1: Check if @types/vscode is in devDependencies**

Read `apps/prism-vscode/package.json` and look for `@types/vscode` in devDependencies.

- [ ] **Step 2: Install @types/vscode if missing**

If @types/vscode is not in devDependencies:

```bash
cd apps/prism-vscode && npm install --save-dev @types/vscode
```

If it IS in devDependencies but node_modules/@types/vscode doesn't exist, run:

```bash
cd /c/Users/digit/Developer/prism-plugin && npm install
```

- [ ] **Step 3: Verify type checking**

Run: `cd apps/prism-vscode && npm run check-types 2>&1 | tail -5`
Expected: No errors (exit 0)

If there are still errors in tree providers, read the files and fix the TypeScript issues. Common pattern: class needs to extend `vscode.TreeItem` and properties like `tooltip`, `iconPath`, `contextValue`, `command` come from the parent class.

- [ ] **Step 4: Commit**

```bash
git add apps/prism-vscode/package.json apps/prism-vscode/src/providers/
git commit -m "fix: add @types/vscode and fix tree provider type errors"
```

---

### Task 4: Full VSIX Build Verification

**Files:**
- Verify: Full build pipeline

- [ ] **Step 1: Run complete VSIX build**

```bash
cd apps/prism-vscode && npx @vscode/vsce package \
  --no-dependencies \
  --baseContentUrl https://github.com/TheDigitalGriot/prism-plugin/tree/main/apps/prism-vscode \
  --baseImagesUrl https://github.com/TheDigitalGriot/prism-plugin/raw/main/apps/prism-vscode \
  --out ../prism-setup/resources/extensions/prism.vsix
```

Expected: `DONE  Packaged: ../prism-setup/resources/extensions/prism.vsix`

- [ ] **Step 2: Verify artifact**

Run: `ls -la apps/prism-setup/resources/extensions/prism.vsix`
Expected: File exists, size > 10MB

- [ ] **Step 3: Commit VSIX if build changed it**

```bash
git add apps/prism-setup/resources/extensions/prism.vsix
git commit -m "chore: rebuild VSIX with fixed vite config"
```

---

## Success Criteria

### Automated Verification
- [ ] `cd apps/prism-vscode && npm run check-types` — exits 0
- [ ] `cd apps/prism-vscode && npm run build:panel` — exits 0
- [ ] `cd apps/prism-vscode && npm run build:webview` — exits 0
- [ ] VSIX packages successfully
- [ ] `ls apps/prism-setup/resources/extensions/prism.vsix` — file exists
