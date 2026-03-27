# Prism — Launch Guide

How to run every app in the monorepo.

> **Prerequisite:** Run `npm install` from the project root to install all workspace dependencies at once.

---

## CLI Dashboard (Go TUI)

```bash
cd cmd/prism-cli
go run .              # Run directly without building a binary
go run . [args]       # Run with arguments
make build            # Build binary → bin/prism-cli[.exe]
make run ARGS=...     # Build + run (requires stories.json)
make install          # Install to GOPATH/bin
```

Other commands: `make test`, `make lint`, `make build-all` (cross-compile), `make clean`.

---

## VSCode Extension

```bash
cd cmd/prism-vscode
npm run watch         # Watches: esbuild + webview (port 5173) + panel (port 5175)
```

Then press **F5** in VSCode to launch the Extension Development Host.

Individual watchers:

| Command | What |
|---------|------|
| `npm run watch:esbuild` | Extension TypeScript (esbuild --watch) |
| `npm run watch:webview` | Sidebar chat UI — Vite dev server on port 5173 |
| `npm run watch:panel` | Bottom panel UI — Vite dev server on port 5175 |

Production build: `npm run package`

---

## Electron App

```bash
cd cmd/prism-electron
npm start             # Launches Electron via Forge + Vite hot reload (port 5173)
```

| Command | What |
|---------|------|
| `npm run package` | Package app |
| `npm run make` | Create platform installers (Windows/macOS/Linux) |
| `npm run lint` | ESLint |

---

## Prism Eval (Electron)

```bash
cd prism-eval
npm start             # Launches Electron via Forge + Vite hot reload
```

| Command | What |
|---------|------|
| `npm run package` | Package app |
| `npm run make` | Create platform installers |
| `npm run lint` | ESLint |

---

## Prism Docs (VitePress)

```bash
cd prism-docs
npm run docs:dev      # VitePress dev server with hot reload
npm run docs:build    # Production build
npm run docs:preview  # Preview production build locally
```

---

## Port Reference

| App | Port | Service |
|-----|------|---------|
| VSCode webview-ui | 5173 | Sidebar chat (Vite) |
| VSCode webview-panel | 5175 | Bottom panel (Vite) |
| Electron app | 5173 | IDE shell (Vite) |
| Prism Eval | 5173 | Eval UI (Vite) |
| Prism Docs | 5173 | VitePress dev server |

> **Note:** Apps sharing port 5173 will auto-increment if another is already running (e.g. 5174, 5175…).
