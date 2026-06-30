import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket as WS } from "ws";
import { PaseoWebSocketAdapter } from "./paseo-websocket";
import type { ServiceDescriptor } from "../protocol";

interface MockPaseo {
  url: string;
  close: () => Promise<void>;
  pushTimeline: (data: Record<string, unknown>) => void;
}

/** A minimal stand-in for the paseo daemon: hello→welcome, *_request→*_response, push frames. */
function startMockPaseo(): Promise<MockPaseo> {
  return new Promise((resolve) => {
    const http = createServer();
    const wss = new WebSocketServer({ server: http });
    let sock: WS | undefined;

    wss.on("connection", (ws) => {
      sock = ws;
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (msg.type === "hello") {
          ws.send(JSON.stringify({ type: "welcome", sessionId: "sess-1", daemonVersion: "9.9.9", capabilities: {} }));
          return;
        }
        if (typeof msg.type === "string" && msg.type.endsWith("_request")) {
          const base = msg.type.slice(0, -"_request".length);
          if (base === "fetch_agents") {
            ws.send(JSON.stringify({ type: "fetch_agents_response", requestId: msg.requestId, agents: [{ id: "a1", status: "idle" }] }));
          } else if (base === "boom") {
            ws.send(JSON.stringify({ type: "boom_response", requestId: msg.requestId, error: "kaboom" }));
          } else {
            ws.send(JSON.stringify({ type: `${base}_response`, requestId: msg.requestId, echoed: base }));
          }
        }
      });
    });

    http.listen(0, "127.0.0.1", () => {
      const port = (http.address() as AddressInfo).port;
      resolve({
        url: `ws://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => wss.close(() => http.close(() => done()))),
        pushTimeline: (data) => sock?.send(JSON.stringify({ type: "timeline", ...data })),
      });
    });
  });
}

/**
 * Closer stand-in for the LIVE paseo daemon (packages/server websocket-server.ts):
 * the WS only accepts the upgrade on `/ws`, and the hello is answered with a
 * server_info status frame — NOT a `{type:"welcome"}`. Regression guard for the
 * adapter's path normalization + handshake detection.
 */
function startRealisticPaseo(): Promise<MockPaseo> {
  return new Promise((resolve) => {
    const http = createServer();
    const wss = new WebSocketServer({ server: http, path: "/ws" });
    let sock: WS | undefined;

    wss.on("connection", (ws) => {
      sock = ws;
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (msg.type === "hello") {
          ws.send(
            JSON.stringify({
              type: "session",
              message: {
                type: "status",
                payload: { status: "server_info", serverId: "srv_real", version: "0.1.69" },
              },
            }),
          );
        }
      });
    });

    http.listen(0, "127.0.0.1", () => {
      const port = (http.address() as AddressInfo).port;
      resolve({
        url: `ws://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => wss.close(() => http.close(() => done()))),
        pushTimeline: (data) => sock?.send(JSON.stringify({ type: "timeline", ...data })),
      });
    });
  });
}

function desc(url: string): ServiceDescriptor {
  return {
    id: "agent-run",
    name: "agent",
    status: "stopped",
    adapterType: "websocket-paseo",
    endpoint: { local: url },
    capabilities: [],
    healthProbe: "hello",
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("PaseoWebSocketAdapter (paseo-dialect shim)", () => {
  let mock: MockPaseo | undefined;
  let adapter: PaseoWebSocketAdapter | undefined;

  afterEach(async () => {
    await adapter?.disconnect();
    await mock?.close();
    adapter = mock = undefined;
  });

  it("probes via the paseo hello/welcome handshake", async () => {
    mock = await startMockPaseo();
    adapter = new PaseoWebSocketAdapter(desc(mock.url));
    const res = await adapter.probe();
    expect(res.ok).toBe(true);
    expect(res.via).toBe("local");
  });

  it("connects on /ws and accepts the live server_info handshake (no welcome frame)", async () => {
    // The mock only upgrades on /ws and never sends a `welcome`. desc() passes the
    // BARE url, so the adapter must (1) append /ws itself and (2) treat server_info
    // as connection-complete — otherwise probe() fails.
    mock = await startRealisticPaseo();
    adapter = new PaseoWebSocketAdapter(desc(mock.url));
    const res = await adapter.probe();
    expect(res.ok).toBe(true);
    expect(res.via).toBe("local");
  });

  it("translates call() into a requestId-correlated paseo RPC", async () => {
    mock = await startMockPaseo();
    adapter = new PaseoWebSocketAdapter(desc(mock.url));
    const result = (await adapter.call("fetch_agents", {})) as { agents: Array<{ id: string }> };
    expect(result.agents).toEqual([{ id: "a1", status: "idle" }]);
  });

  it("rejects when the paseo response carries an error", async () => {
    mock = await startMockPaseo();
    adapter = new PaseoWebSocketAdapter(desc(mock.url));
    await expect(adapter.call("boom", {})).rejects.toThrow("kaboom");
  });

  it("forwards push frames of the requested type as a stream", async () => {
    mock = await startMockPaseo();
    adapter = new PaseoWebSocketAdapter(desc(mock.url));
    await adapter.probe();
    const iter = adapter.stream("timeline", undefined)[Symbol.asyncIterator]();
    const nextP = iter.next();
    await delay(50); // let the sink register
    mock.pushTimeline({ agentId: "a1", item: "hello" });
    const res = await nextP;
    expect(res.done).toBe(false);
    expect(res.value.kind).toBe("timeline");
    expect((res.value.data as { agentId: string }).agentId).toBe("a1");
    await iter.return?.();
  });
});
