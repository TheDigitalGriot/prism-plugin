---
date: 2026-07-19
topic: "Fragment mobile (EAS/Expo) surface — buildable spec (harvested from apps/prism-mobile)"
tags: [fragment, mobile, expo, eas, harvest, spec]
status: complete — feeds the mobile surface build
---

# Fragment `mobile` (Expo/EAS) surface — buildable spec

## Load-bearing decision
Mobile drops into Fragment's 3-layer model: **`packages/core` (100% reused) + the DOM-free half of `packages/ui` (transport contract `WebviewTransport`, `ProtoBusClient`/services, `AppStateContext`) + a `WebSocketTransport implements WebviewTransport` + ~4 RN screens.** Only the leaf visual components (ChatMessage/TimelineEntry/ModelSelector) are DOM and get re-implemented with RN primitives. Do NOT reproduce prism-mobile's adaptive-connection state machine (paseo-specific).

The mobile transport is a network-backed sibling of vsCodeTransport/electron `window.api`, installed via `setTransport(...)` before React mounts. Speaks the same `{type:'grpc_request'|'grpc_response'|'state-update'}` envelope. App is buildable/runnable standalone (empty core state + "disconnected" indicator); goes live pointed at any host speaking the envelope over WS.

## `templates/mobile/` file tree
```
manifest.json                 # SKIPPED by copier (metadata)
package.json.tmpl             # MUST be .tmpl (else npm globs it as a workspace member)
app.config.js                 # Expo config; neutral placeholders; version single-sourced from ../../VERSION
eas.json                      # EAS profiles; NO secrets (ascAppId/googleServices stripped)
tsconfig.json                 # extends expo/tsconfig.base + {{PACKAGE_SCOPE}}/* path aliases
babel.config.js              # babel-preset-expo + module-resolver alias
metro.config.js              # MUST be .js (copier doesn't token-replace .cjs); monorepo watchFolders + scope alias + .js→.ts resolver
index.ts                     # import "expo-router/entry"
gitignore.tmpl               # RN/Expo + .secrets/ + ios/ android/
app/_layout.tsx              # bootstrapTransport() then <AppStateProvider>
app/(tabs)/_layout.tsx       # Tabs: Chat · Timeline · Settings
app/(tabs)/index.tsx         # Chat (RN, uses useAppState + chatService + core types)
app/(tabs)/timeline.tsx      # Timeline (RN)
app/(tabs)/settings.tsx      # host ws:// URL + connection status
src/transport/ws-transport.ts   # ★ WebSocketTransport implements WebviewTransport (reconnect linear backoff cap 30s; app-level ping keepalive; outbound buffering)
src/transport/host-config.ts    # AsyncStorage host URL; EXPO_PUBLIC_HOST_URL override; default ws://localhost:6767
src/bootstrap/transport-bootstrap.ts  # loadHostUrl → new WebSocketTransport → setTransport; status store
src/components/{MessageBubble,TimelineRow,ModelPicker}.tsx  # RN mirrors of ui leaves
src/theme/tokens.ts          # native mirror of ui/styles/bridge.css tokens
```
No binary assets in base tree (Expo renders defaults) — sidesteps the copier's binary-corruption bug.

## manifest.json
```json
{ "surface": "mobile", "files": ["**/*"], "skip": ["node_modules/**",".expo/**","ios/**","android/**","dist/**"], "workspaceEntry": "apps/mobile", "dependencies": ["core","ui"] }
```

## Wiring edits (5 files)
- `src/commands/init.ts:17` → `VALID_SURFACES = ['electron','vscode','tui','mobile']`
- `src/commands/add.ts` → same allowlist
- `src/index.ts` → add `--mobile` flag to init+add; `--all` pushes mobile; extend error strings
- `src/engine/plugin-discovery.ts:~67` `detectSurfaces` → add 'mobile'
- `plugins/fragment-plugin/scripts/detect-surfaces.py:15` → add 'mobile' + `has_app_config` probe

## Copier gaps (avoid in MVP; fix at root if branded)
1. Binary corruption: `copier.ts` reads/writes all as utf-8 → destroys PNGs. MVP ships zero binaries. Root fix: read text→replaceTokens, else `readFileSync(src)` Buffer.
2. `.cjs` not in TEXT_EXTENSIONS → no token replacement. Use `.js` (metro.config.js).

## ws-transport.ts (the daemon-connection module) — key shape
`class WebSocketTransport implements WebviewTransport` with `postMessage/onMessage/getState/setState`; RN global `WebSocket`; JSON envelope; reconnect (linear backoff cap 30s), app-level ping (half-open detection), outbox buffering until open. Bootstrap calls `setTransport(new WebSocketTransport({url}))` before `<AppStateProvider>`.

## Reusable architectural patterns to encode (Prism-image)
1. Transport contract + per-surface adapters (vscode postMessage / electron IPC / mobile WebSocket) over one gRPC-over-postMessage envelope.
2. Shared core + thin per-surface views (logic/state/services in core+ui; only rendering per-surface).
3. Connection-as-data (HostProfile = serverId + candidate routes + preferred).
4. Reconnect discipline (linear backoff cap 30s + app ping + outbound buffer).
5. LAN reachability rule (phone localhost = phone; use LAN IP or relay; release needs usesCleartextTraffic for ws://).
6. Secret resolution: env-first → gitignored local → omit.
7. Version single-sourced from repo-root VERSION (pkg.version fallback).
8. EAS variant conventions (APP_VARIANT dev/prod distinct name+bundleId; profiles development/preview/production/production-apk; runtimeVersion appVersion).
9. WS schema evolution: append-only, new fields optional, never narrow/remove.
10. Native-vs-OTA boundary (icons/permissions/intent-filters need eas build, not eas update).

## Paseo-specific — MUST NOT ship (use env/placeholders)
Relay endpoints (prism.digitalgriot.studio/relay, relay.paseo.sh, app.paseo.sh) → env only, no fallback. EAS project id `4e6ac688…` → `process.env.EAS_PROJECT_ID`. Owner `digitalgriot` → `EAS_OWNER`. iOS ASC App ID `6758887924` → strip. Bundle IDs `com.thedigitalgriot.prism*` → `com.example.{{PROJECT_NAME}}*` placeholder. Associated domains / AASA / Apple Team ID `M6K8N36JN8` → omit. googleServices/plist/.secrets/** → not in template, gitignored. Push/camera-QR/E2E relay crypto (NaCl)/PASEO_PASSWORD → excluded (advanced opt-in).
Env keys introduced: EAS_PROJECT_ID, EAS_OWNER, EXPO_PUBLIC_HOST_URL, APP_VARIANT, optional RELAY_ENDPOINT.

## Tests
init.test (mobile case asserts app.config.js/metro.config.js/package.json + workspaces has apps/mobile; extend all-surfaces case), plugin-discovery.test (detects mobile), copier.test (token replace in metro.config.js), add.test (runAdd mobile).

## Connect-time gap (follow-on, not this build)
Mobile is standalone-runnable; live use needs a host speaking the envelope over WS. Fragment has only in-process hosts today. Follow-ons: a `core/src/daemon/ws-daemon.ts` reference bridge; a `mobile-glue.ts` for /fragment-connect.
