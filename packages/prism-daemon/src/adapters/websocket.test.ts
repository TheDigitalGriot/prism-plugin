import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { WebSocketAdapter } from "./websocket";
import { Broker } from "../broker";
import { Registry } from "../registry";
import type { BrokerEnvelope, ServiceDescriptor, WSHello } from "../protocol";

interface MockBackend {
  url: string;
  close: () => Promise<void>;
}

/** A backend that speaks the broker's clean WS dialect: echo (unary) + count (stream). */
function startMockBackend(): Promise<MockBackend> {
  return new Promise((resolve) => {
    const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" }, () => {
      const port = (wss.address() as AddressInfo).port;
      resolve({
        url: `ws://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => wss.close(() => done())),
      });
    });
    wss.on("connection", (ws) => {
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        if (msg.type === "hello") {
          ws.send(JSON.stringify({
            type: "welcome",
            capabilities: [{ name: "agent", description: "mock", methods: ["echo", "count"] }],
          }));
        } else if (msg.type === "request" && msg.stream) {
          for (let i = 0; i < 3; i++) {
            ws.send(JSON.stringify({ type: "stream", id: msg.id, seq: i, kind: "data", event: { n: i } }));
          }
          ws.send(JSON.stringify({ type: "stream_end", id: msg.id }));
        } else if (msg.type === "request") {
          ws.send(JSON.stringify({ type: "response", id: msg.id, ok: true, result: msg.payload }));
        }
      });
    });
  });
}

function descFor(url: string): ServiceDescriptor {
  return {
    id: "agent-run",
    name: "agent",
    status: "stopped",
    adapterType: "websocket",
    endpoint: { local: url },
    capabilities: [],
    healthProbe: "hello",
  };
}

describe("WebSocketAdapter (Phase 2)", () => {
  let backend: MockBackend | undefined;
  let adapter: WebSocketAdapter | undefined;

  afterEach(async () => {
    await adapter?.disconnect();
    await backend?.close();
    adapter = undefined;
    backend = undefined;
  });

  it("probes ready and reports the discovery manifest", async () => {
    backend = await startMockBackend();
    adapter = new WebSocketAdapter(descFor(backend.url));
    const probe = await adapter.probe();
    expect(probe.ok).toBe(true);
    expect(probe.manifest?.[0]?.methods).toContain("echo");
  });

  it("call() round-trips a unary request", async () => {
    backend = await startMockBackend();
    adapter = new WebSocketAdapter(descFor(backend.url));
    const result = await adapter.call("echo", { hello: "world" });
    expect(result).toEqual({ hello: "world" });
  });

  it("stream() yields every frame in order, then ends", async () => {
    backend = await startMockBackend();
    adapter = new WebSocketAdapter(descFor(backend.url));
    const events: unknown[] = [];
    for await (const ev of adapter.stream("count", {})) events.push(ev.data);
    expect(events).toEqual([{ n: 0 }, { n: 1 }, { n: 2 }]);
  });

  it("probe() returns ok:false when the endpoint is dead (no hang)", async () => {
    adapter = new WebSocketAdapter(descFor("ws://127.0.0.1:1"));
    const probe = await adapter.probe();
    expect(probe.ok).toBe(false);
  });
});

describe("Broker dispatch through an adapter (Phase 2)", () => {
  let backend: MockBackend | undefined;
  let broker: Broker | undefined;
  let client: WebSocket | undefined;

  afterEach(async () => {
    client?.close();
    await broker?.close();
    await backend?.close();
    backend = undefined;
    broker = undefined;
    client = undefined;
  });

  it("routes a client envelope to the agent-run adapter and returns its result", async () => {
    backend = await startMockBackend();
    const registry = new Registry();
    registry.upsert(descFor(backend.url));
    broker = new Broker({ registry });
    const port = await broker.listen("127.0.0.1", 0);

    client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      client!.once("open", () => resolve());
      client!.once("error", reject);
    });
    const next = (): Promise<Record<string, unknown>> =>
      new Promise((resolve) => client!.once("message", (d) => resolve(JSON.parse(d.toString()) as Record<string, unknown>)));

    client.send(JSON.stringify({ type: "hello", clientId: "t", version: "0" } satisfies WSHello));
    await next(); // welcome

    client.send(JSON.stringify({ id: "r1", service: "agent-run", method: "echo", payload: { a: 1 }, ts: 1 } satisfies BrokerEnvelope));
    const res = await next();
    expect(res.type).toBe("response");
    expect(res.ok).toBe(true);
    expect(res.result).toEqual({ a: 1 });
  });
});
