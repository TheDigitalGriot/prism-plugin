# Domain Hints

Different work surfaces have different failure modes. A generic implementer prompt will trip on R3F render-loop costs the same way it trips on Electron context isolation — the failures are domain-specific and predictable. **Inject the right primer and most of these failures vanish before they happen.**

The controller picks the domain at run start (stored in `state.json.domain`) and pastes the matching primer into every implementer dispatch. Reviewers also receive the primer so they know what to look for.

## Domain Detection

Auto-detect from plan content + repo signals:

| Signal | Domain |
|---|---|
| Plan mentions `useFrame`, `<Canvas>`, `three`, `r3f`, shader, GLB, drei | `r3f` |
| Plan mentions `ipcMain`, `BrowserWindow`, `preload`, `contextBridge`, `electron`, main vs renderer | `electron` |
| Plan touches both `apps/api/` and `apps/web/`, or has a contracts section | `fullstack` |
| Files live under `prototypes/`, `playground/`, `experiments/`, `sandbox/` | `experiment` |
| More than one of the above applies | `mixed` (use multiple primers concatenated) |

The user can override at run start: "execute the plan, domain=r3f". Override always wins.

---

## R3F Primer

```
## Domain: React Three Fiber

You are working in a React Three Fiber codebase. Three.js objects live inside React
components, but they have non-React costs you must respect.

**Render loop discipline:**
- `useFrame(callback, priority)` runs every frame. Anything inside is a per-frame cost.
- Never allocate inside useFrame: no `new Vector3()`, no array literals, no object spread.
  Allocate once outside, mutate inside. Garbage collection during the frame loop is the
  #1 R3F performance killer.
- Never set React state inside useFrame unless you mean to re-render every frame.
  Mutate refs instead: `meshRef.current.position.x += 0.01`.

**Suspense boundaries:**
- `useGLTF`, `useTexture`, and friends suspend. They MUST be inside a `<Suspense>` boundary
  with a fallback. The fallback should be a `<mesh>` or null, never HTML.
- `useGLTF.preload(path)` outside the component lets you start loading before mount.

**Disposal:**
- Geometries, materials, textures, and render targets must be disposed when unmounted.
  drei components handle this; raw three.js objects do not. Use `useEffect` cleanup or
  the `dispose` prop on `<primitive>`.

**Common bugs to NOT introduce:**
- Re-creating geometries/materials per render (memoize with `useMemo`)
- Forgetting `args={[...]}` on `<bufferGeometry>` / `<meshStandardMaterial>`
- Mutating shared three.js objects across instances (clone first)
- Putting `<Canvas>` inside a wrapper that re-mounts on parent state change
- Forgetting that `<Html>` from drei requires CSS positioning context

**Performance verification before claiming DONE:**
- Frame budget: target 16ms (60fps). Add a `<Stats />` component locally to verify.
- Draw call count: keep under 100 for the scope of this task unless the spec says otherwise.

**Patterns to follow if they exist in this repo:**
- Check for an existing scene editor / staging abstraction before adding controls
- Check for a material registry before defining new materials inline
```

---

## Electron Primer

```
## Domain: Electron Desktop App

You are working in an Electron app. The most important thing is the main/renderer split.

**Process boundaries:**
- `main` process has Node APIs and OS access. Lives in `electron/main/` or `apps/electron/main/`.
- `renderer` process is a sandboxed Chromium window. NO Node APIs by default. Lives wherever
  the web bundle lives.
- Crossing the boundary requires IPC (`ipcMain` + `ipcRenderer`) or a `contextBridge`-exposed
  preload script.

**Security defaults you MUST respect:**
- `contextIsolation: true` (always)
- `nodeIntegration: false` (always)
- `sandbox: true` for renderer windows
- Never expose `ipcRenderer` directly to the renderer — wrap specific channels in `contextBridge.exposeInMainWorld`
- CSP must be set; don't loosen it without explicit user approval

**IPC patterns:**
- Use `ipcMain.handle` + `ipcRenderer.invoke` for request/response (returns promises)
- Use `ipcMain.on` + `ipcRenderer.send` for fire-and-forget
- Every IPC channel should have a typed contract — check for an existing contracts file
  (often `apps/electron/src/shared/ipc-contracts.ts` or similar)

**File system access:**
- File reads/writes happen in main, never in renderer
- Renderer requests via IPC; main validates the path is inside an allowed directory before touching it
- Path validation MUST handle `..` traversal and absolute paths

**Common bugs to NOT introduce:**
- Calling Node APIs from a React component (will silently fail in renderer)
- Forgetting to register IPC handlers in main before the renderer tries to invoke them
- Returning non-cloneable values across IPC (functions, classes, DOM nodes — none survive structured clone)
- Putting secrets in renderer environment variables (they ship in the bundle)
- Auto-updating without code-signing (will break on macOS Gatekeeper)

**Verification before claiming DONE:**
- Test in both dev (`electron .`) and packaged (`electron-builder` or your packager) modes
- Open DevTools and check there are no CSP violations or IPC errors
- For new IPC channels: verify the contract type is exported AND the preload script bridges it
```

---

## Full-Stack Primer

```
## Domain: Full-Stack (API + Web)

You are working across an API and a web client. The contract between them is the most
fragile thing in the stack and the most common source of "it worked locally" bugs.

**Contract discipline:**
- Look for a contracts directory: `.prism/shared/contracts/`, `packages/contracts/`,
  `shared/types/`, `apps/api/src/schemas/`. Whatever the repo uses, that is the source
  of truth for shapes that cross the API/web boundary.
- If you change a contract, you MUST update both sides in this same task. Never one side.
- If a contract change breaks existing callers, list them in DONE_WITH_CONCERNS — the
  reviewer will grep for blast radius.

**Type sharing:**
- Prefer one-source types (zod schema → infer types on both sides, or generated TS from
  OpenAPI/protobuf). Hand-mirrored types drift.
- If the repo uses tRPC/oRPC: do not bypass the router; add a procedure
- If the repo uses REST: validate the request body in the handler, never trust the client

**Auth boundaries:**
- Never trust client-supplied user IDs. Read identity from the session/token, not the body.
- Never run authorization checks in the client only. The client check is UX, the server
  check is security. Both, always.

**Database:**
- Migrations are forward-only unless the repo's convention says otherwise
- Every migration needs a corresponding type/schema update
- Never run a migration as part of an unrelated task — split it into its own task

**Common bugs to NOT introduce:**
- Updating the API response shape without updating the client's expected type
- Adding a required field to a request without updating the client's form
- Forgetting cache invalidation after a mutation (TanStack Query, SWR, RTK Query all need it)
- N+1 queries from forgetting to include relations
- Returning DB rows directly to the client (leaks fields the client shouldn't see)

**Verification before claiming DONE:**
- Run the API typecheck AND the web typecheck — both must pass
- If you changed a contract, run any contract-test command the repo defines
- Manually test the round-trip if the spec says so
```

---

## Experiment Primer

```
## Domain: Experimental Sandbox

You are working in an experimental sandbox. The rules are deliberately loose. Move fast.
Prefer working code over polished code. Don't refactor — copy and modify if it's faster.

**What still matters here:**
- Don't import production modules into the sandbox (creates an undeclared dependency edge)
- Don't write outside the sandbox directory
- Don't commit secrets or API keys, even in test files
- Don't introduce infinite loops or unbounded resource use — kill scripts within 30s if
  they don't terminate

**What does NOT matter here:**
- Naming consistency with the rest of the repo
- Test coverage (unless the experiment IS a test for a hypothesis)
- Comments / docs
- Pattern adherence
- Dead code cleanup

**Why the looseness:** experiments exist to find out whether something works. Polishing an
experiment that's about to be deleted is waste. If the experiment graduates, the
graduation task does the polishing.

**Verification before claiming DONE:**
- The thing runs end-to-end at least once
- The thing demonstrates whatever the spec said it should demonstrate
- A `README.md` in the sandbox dir (one paragraph) explains what the experiment is and how
  to run it — this is the ONE doc requirement
```

---

## Mixed Domain

If `state.json.domain == "mixed"`, paste the relevant primers concatenated, in this order:
contract-bearing primers first (electron, fullstack), then ui-bearing (r3f), then experiment last. The reviewer prompt should also receive all of them.

## Adding A New Domain

When the user works in a domain not covered here (mobile, embedded, ML training, etc.), add a new section to this file. Domain primers are cheap to add and they pay for themselves on the first averted bug.

The format is:
1. One-line domain summary
2. The 2-3 most failure-prone concepts
3. "Common bugs to NOT introduce" — concrete and grep-able
4. "Verification before claiming DONE" — what evidence the implementer must produce
