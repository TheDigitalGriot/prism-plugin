import { describe, it, expect, vi } from "vitest";
import { DaemonManager, type DaemonManagerDeps, type FetchFn } from "./daemon-manager";

// ── Test doubles ───────────────────────────────────────────────────────────

class FakeChild {
  pid = 4242;
  killed = false;
  private listeners: Array<(code: number | null) => void> = [];
  on(event: "exit", l: (code: number | null) => void): this {
    if (event === "exit") this.listeners.push(l);
    return this;
  }
  kill(): boolean {
    this.killed = true;
    this.emitExit(null); // simulate the process dying on kill (async in real life)
    return true;
  }
  emitExit(code: number | null): void {
    for (const l of [...this.listeners]) l(code);
  }
}

/** A fetch that walks a sequence: null → connection refused; {version} → healthy. */
function makeFetch(seq: Array<{ version: string } | null>): FetchFn {
  let i = 0;
  return async () => {
    const item = seq[Math.min(i, seq.length - 1)] ?? null;
    i++;
    if (item === null) throw new Error("ECONNREFUSED");
    return { ok: true, json: async () => ({ ok: true, version: item.version }) };
  };
}

function deps(over: Partial<DaemonManagerDeps>): DaemonManagerDeps {
  return {
    fork: () => new FakeChild(),
    brokerEntry: "broker.cjs",
    configPath: "services.config.json",
    port: 6780,
    expectedVersion: "0.1.0",
    probeAttempts: 5,
    probeIntervalMs: 1,
    restartBackoffMs: [1],
    maxRestarts: 3,
    ...over,
  };
}

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("DaemonManager", () => {
  it("adopts a pre-existing healthy broker without forking", async () => {
    const fork = vi.fn(() => new FakeChild());
    const m = new DaemonManager(deps({ fork, fetchFn: makeFetch([{ version: "0.1.0" }]) }));
    const s = await m.start();
    expect(fork).not.toHaveBeenCalled();
    expect(s.status).toBe("running");
    expect(s.adopted).toBe(true);
    expect(s.version).toBe("0.1.0");
  });

  it("adopts even on version mismatch (cannot kill a foreign broker)", async () => {
    const fork = vi.fn(() => new FakeChild());
    const m = new DaemonManager(deps({ fork, fetchFn: makeFetch([{ version: "9.9.9" }]) }));
    const s = await m.start();
    expect(fork).not.toHaveBeenCalled();
    expect(s.status).toBe("running");
    expect(s.adopted).toBe(true);
    expect(s.versionMismatch).toBe(true);
  });

  it("spawns and reaches running when health responds", async () => {
    const child = new FakeChild();
    const fork = vi.fn(() => child);
    const m = new DaemonManager(deps({ fork, fetchFn: makeFetch([null, { version: "0.1.0" }]) }));
    const s = await m.start();
    expect(fork).toHaveBeenCalledTimes(1);
    expect(s.status).toBe("running");
    expect(s.pid).toBe(child.pid);
    expect(s.adopted).toBe(false);
    expect(s.versionMismatch).toBe(false);
  });

  it("reports error when health never responds", async () => {
    const m = new DaemonManager(
      deps({ fork: () => new FakeChild(), fetchFn: makeFetch([null]), probeAttempts: 3 }),
    );
    const s = await m.start();
    expect(s.status).toBe("error");
  });

  it("auto-restarts after an unexpected exit", async () => {
    const first = new FakeChild();
    const pending = [first, new FakeChild()];
    const fork = vi.fn(() => pending.shift() ?? new FakeChild());
    const m = new DaemonManager(
      deps({ fork, fetchFn: makeFetch([null, { version: "0.1.0" }, { version: "0.1.0" }]) }),
    );
    await m.start();
    expect(fork).toHaveBeenCalledTimes(1);
    first.emitExit(1); // crash
    await tick();
    expect(fork).toHaveBeenCalledTimes(2);
    expect(m.getStatus().status).toBe("running");
  });

  it("restarts once on version mismatch then accepts", async () => {
    const pending = [new FakeChild(), new FakeChild()];
    const fork = vi.fn(() => pending.shift() ?? new FakeChild());
    const m = new DaemonManager(
      deps({ fork, fetchFn: makeFetch([null, { version: "9.9.9" }, { version: "0.1.0" }]) }),
    );
    const s = await m.start();
    expect(fork).toHaveBeenCalledTimes(2);
    expect(s.status).toBe("running");
    expect(s.version).toBe("0.1.0");
    expect(s.versionMismatch).toBe(false);
  });

  it("stop() kills a spawned broker and prevents restart", async () => {
    const child = new FakeChild();
    const m = new DaemonManager(deps({ fork: () => child, fetchFn: makeFetch([null, { version: "0.1.0" }]) }));
    await m.start();
    const s = m.stop();
    expect(child.killed).toBe(true);
    expect(s.status).toBe("stopped");
    child.emitExit(0); // a late exit must not trigger a restart
    await tick(10);
    expect(m.getStatus().status).toBe("stopped");
  });

  it("emits statusChange on transitions", async () => {
    const seen: string[] = [];
    const m = new DaemonManager(deps({ fork: () => new FakeChild(), fetchFn: makeFetch([null, { version: "0.1.0" }]) }));
    m.on("statusChange", (s: { status: string }) => seen.push(s.status));
    await m.start();
    expect(seen).toContain("starting");
    expect(seen).toContain("running");
  });
});
