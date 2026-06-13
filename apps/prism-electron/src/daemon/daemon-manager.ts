/**
 * DaemonManager — spawns + supervises the prism-daemon broker subprocess for the
 * desktop. Status machine: stopped → starting → running | error, with crash-restart
 * (backoff), version-sync, and adopt-don't-fight for a broker already on the port.
 *
 * Deliberately electron-free: `fork` and `fetchFn` are injected so this unit-tests
 * headless (no Electron runtime, no real ports). The wiring layer (main.ts) passes
 * Electron's `utilityProcess.fork` + global `fetch`.
 *
 * Reference pattern (read-only, vendored): apps/prism-mobile/packages/desktop/src/daemon.
 */
import { EventEmitter } from "node:events";

export type DaemonStatusKind = "stopped" | "starting" | "running" | "error";

export interface DaemonStatus {
  status: DaemonStatusKind;
  port: number;
  pid: number | null;
  version: string | null;
  /** True when we attached to a broker someone else started (we won't kill it). */
  adopted: boolean;
  /** True when the running broker's version != the bundled expectation. */
  versionMismatch: boolean;
  message?: string;
}

/** Minimal shape of the child we need — satisfied by Electron's UtilityProcess. */
export interface ForkedChild {
  readonly pid?: number;
  kill(): boolean | void;
  on(event: "exit", listener: (code: number | null) => void): unknown;
}

export type ForkFn = (
  entry: string,
  args: string[],
  opts: { env: Record<string, string | undefined>; stdio?: unknown },
) => ForkedChild;

export type FetchFn = (input: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

export interface DaemonManagerDeps {
  fork: ForkFn;
  brokerEntry: string;
  configPath: string;
  port: number;
  expectedVersion: string;
  fetchFn?: FetchFn;
  /** Health-poll attempts after spawn (default 10). */
  probeAttempts?: number;
  /** Delay between health polls, ms (default 500). */
  probeIntervalMs?: number;
  /** Restart backoff schedule, ms (default [1000,2000,4000,8000,16000], capped at last). */
  restartBackoffMs?: number[];
  /** Max consecutive crash-restarts before giving up (default 5). */
  maxRestarts?: number;
  log?: (msg: string, ...rest: unknown[]) => void;
}

export class DaemonManager extends EventEmitter {
  private readonly _fork: ForkFn;
  private readonly _fetch: FetchFn;
  private readonly _brokerEntry: string;
  private readonly _configPath: string;
  private readonly _port: number;
  private readonly _expectedVersion: string;
  private readonly _probeAttempts: number;
  private readonly _probeIntervalMs: number;
  private readonly _backoff: number[];
  private readonly _maxRestarts: number;
  private readonly _log: (msg: string, ...rest: unknown[]) => void;

  private _proc: ForkedChild | null = null;
  private _intentionalStop = false;
  private _restartCount = 0;
  private _versionRestartUsed = false;
  private _restartTimer: ReturnType<typeof setTimeout> | null = null;
  private _status: DaemonStatus;

  constructor(deps: DaemonManagerDeps) {
    super();
    this._fork = deps.fork;
    this._fetch = deps.fetchFn ?? ((input, init) => fetch(input, init) as unknown as ReturnType<FetchFn>);
    this._brokerEntry = deps.brokerEntry;
    this._configPath = deps.configPath;
    this._port = deps.port;
    this._expectedVersion = deps.expectedVersion;
    this._probeAttempts = deps.probeAttempts ?? 10;
    this._probeIntervalMs = deps.probeIntervalMs ?? 500;
    this._backoff = deps.restartBackoffMs ?? [1000, 2000, 4000, 8000, 16000];
    this._maxRestarts = deps.maxRestarts ?? 5;
    this._log = deps.log ?? (() => undefined);
    this._status = {
      status: "stopped",
      port: this._port,
      pid: null,
      version: null,
      adopted: false,
      versionMismatch: false,
    };
  }

  getStatus(): DaemonStatus {
    return { ...this._status };
  }

  private _setStatus(partial: Partial<DaemonStatus>): void {
    this._status = { ...this._status, ...partial };
    this.emit("statusChange", this.getStatus());
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async _probeHealth(): Promise<{ version: string } | null> {
    try {
      const res = await this._fetch(`http://127.0.0.1:${this._port}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { ok?: boolean; version?: unknown };
      if (body && body.ok) {
        return { version: typeof body.version === "string" ? body.version : "unknown" };
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Start the broker. Adopts a pre-existing one on the port; otherwise spawns + probes. */
  async start(): Promise<DaemonStatus> {
    if (this._status.status === "running" || this._status.status === "starting") {
      return this.getStatus();
    }
    this._intentionalStop = false;

    const pre = await this._probeHealth();
    if (pre) {
      this._setStatus({
        status: "running",
        adopted: true,
        pid: null,
        version: pre.version,
        versionMismatch: pre.version !== this._expectedVersion,
        message:
          pre.version !== this._expectedVersion
            ? `adopted existing broker (version ${pre.version} != expected ${this._expectedVersion})`
            : "adopted existing broker",
      });
      return this.getStatus();
    }

    return this._spawnAndProbe();
  }

  private async _spawnAndProbe(): Promise<DaemonStatus> {
    this._setStatus({ status: "starting", adopted: false, message: undefined });

    let child: ForkedChild;
    try {
      child = this._fork(this._brokerEntry, [], {
        env: {
          ...process.env,
          PRISM_DAEMON_PORT: String(this._port),
          PRISM_DAEMON_CONFIG: this._configPath,
        },
        stdio: "pipe",
      });
    } catch (err) {
      this._setStatus({ status: "error", message: `fork failed: ${String(err)}` });
      return this.getStatus();
    }

    this._proc = child;
    // Bind the exit handler to THIS child so a stale child's late exit (e.g. after
    // a restart already replaced it) is ignored — utilityProcess emits exit async.
    child.on("exit", (code) => this._onChildExit(child, code));

    for (let i = 0; i < this._probeAttempts; i++) {
      await this._delay(this._probeIntervalMs);
      const h = await this._probeHealth();
      if (h) {
        const mismatch = h.version !== this._expectedVersion;
        this._setStatus({
          status: "running",
          pid: child.pid ?? null,
          version: h.version,
          versionMismatch: mismatch,
          message: undefined,
        });
        this._restartCount = 0;
        // Version-sync: a freshly-spawned broker reporting the wrong version is a
        // build inconsistency. Restart once to self-heal, then accept.
        if (mismatch && !this._versionRestartUsed) {
          this._versionRestartUsed = true;
          this._log(`version mismatch: broker ${h.version} != expected ${this._expectedVersion}, restarting once`);
          return this.restart();
        }
        return this.getStatus();
      }
    }

    this._setStatus({ status: "error", message: "health probe timed out" });
    return this.getStatus();
  }

  private _onChildExit(child: ForkedChild, code: number | null): void {
    // Stale child (already detached by stop()/restart()) — ignore its exit.
    if (child !== this._proc) return;
    this._proc = null;
    this._setStatus({ pid: null });
    if (this._intentionalStop) return;
    this._log(`broker exited unexpectedly (code ${code ?? "null"})`);
    this._scheduleRestart();
  }

  private _scheduleRestart(): void {
    if (this._restartCount >= this._maxRestarts) {
      this._setStatus({ status: "error", message: `gave up after ${this._maxRestarts} restarts` });
      return;
    }
    const delay = this._backoff[Math.min(this._restartCount, this._backoff.length - 1)] ?? 1000;
    this._restartCount += 1;
    this._setStatus({ status: "starting", message: `restarting (#${this._restartCount})` });
    this._restartTimer = setTimeout(() => {
      this._restartTimer = null;
      void this._spawnAndProbe();
    }, delay);
  }

  private _clearRestartTimer(): void {
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
  }

  /** Restart: kill the process we own (if any), then spawn + probe fresh. */
  async restart(): Promise<DaemonStatus> {
    this._clearRestartTimer();
    this._intentionalStop = false;
    // Detach FIRST so the old child's (async) exit is ignored by _onChildExit.
    const old = this._proc;
    this._proc = null;
    if (old && !this._status.adopted) old.kill();
    return this._spawnAndProbe();
  }

  /** Stop supervising. Kills the broker only if we spawned it (adopted ones are left alive). */
  stop(): DaemonStatus {
    this._intentionalStop = true;
    this._clearRestartTimer();
    const old = this._proc;
    this._proc = null;
    if (old && !this._status.adopted) old.kill();
    this._setStatus({ status: "stopped", pid: null, message: undefined });
    return this.getStatus();
  }
}
