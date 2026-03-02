---
title: Platform Modules
description: Directory detection, file watching, and .prism/ initialization modules extracted to packages/prism-core.
outline: [2, 3]
---

# Platform Modules (Electron)

> **Note**: The `src/prism/config.ts` (79 lines), `src/prism/watcher.ts` (72 lines), and `src/prism/init.ts` (50 lines) modules have been extracted to `packages/prism-core/src/prism/` and are now consumed via `@prism-core/*` aliases. The descriptions below document their functionality as it exists in the shared package.

## `src/prism/config.ts` — Directory Detection

Replaces `vscode.workspace.fs.stat()` with pure Node.js:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export async function detectPrismDir(projectDir: string): Promise<string | undefined> {
  const candidate = path.join(projectDir, '.prism');
  try {
    await fs.stat(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

export async function detectStoriesPath(prismDir: string): Promise<string | undefined> {
  const candidate = path.join(prismDir, 'stories', 'stories.json');
  try {
    await fs.stat(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}
```

Also provides `getPrismConfig(prismDir)` which builds a `PrismConfig` object with all subdirectory paths (research, plans, validation, spectrum, handoffs, etc.).

## `src/prism/watcher.ts` — File Watching

Replaces `vscode.FileSystemWatcher` with chokidar:

```typescript
export class PrismWatcher extends EventEmitter {
  private _watcher: FSWatcher | null = null;

  start(prismDir: string): void {
    this.dispose();
    this._watcher = chokidar.watch(prismDir, {
      ignoreInitial: true,
      awaitWriteFinish: true,
      persistent: false,
    });
    this._watcher.on('all', (event, filePath) => {
      const type = this._classify(prismDir, filePath);
      this.emit('change', { type, filePath });
    });
  }
}
```

File changes are classified into categories:

| Category | Pattern | Triggers |
|----------|---------|----------|
| `stories` | `stories/*` | Stories reload |
| `research` | `shared/research/*` | Research list refresh |
| `plans` | `shared/plans/*` | Plans list refresh |
| `validation` | `shared/validation/*` | Validation refresh |
| `spectrum` | `shared/spectrum/*` | Spectrum progress update |
| `other` | Everything else | No specific action |

## `src/prism/init.ts` — Directory Initialization

Creates the full `.prism/` directory structure:

```
.prism/
├── stories/
├── shared/
│   ├── research/
│   ├── plans/
│   ├── validation/
│   ├── spectrum/
│   ├── handoffs/
│   ├── prs/
│   ├── docs/
│   └── ref/
└── local/            ← .gitignore written here
```

Extracted from prism-vscode's `prism/init.ts` to avoid a transitive `vscode` import (the original file co-locates `initPrismDirInWorkspace` which depends on `vscode.workspace`).
