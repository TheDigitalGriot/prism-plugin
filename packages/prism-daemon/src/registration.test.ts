import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { Broker } from "./broker";
import { Registry } from "./registry";
import type { WSHello } from "./protocol";

interface MockFlask {
  baseUrl: string;
  close: () => Promise<void>;
}

function startMockFlask(): Promise<MockFlask> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.method === "GET" && req.url === "/skills") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ skills: [{ name: "query", description: "", methods: ["query"] }] }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

type Msg = Record<string, unknown>;

function collector(ws: WebSocket): {
  waitFor: (pred: (m: Msg) => boolean, timeoutMs?: number) => Promise<Msg>;
} {
  const messages: Msg[] = [];
  const waiters: Array<{ pred: (m: Msg) => boolean; resolve: (m: Msg) => void }> = [];
  ws.on("message", (d) => {
    let m: Msg;
    try {
      m = JSON.parse(d.toString()) as Msg;
    } catch {
      return;
    }
    messages.push(m);
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i]!.pred(m)) {
        waiters[i]!.resolve(m);
        waiters.splice(i, 1);
      }
    }
  });
  return {
    waitFor(pred, timeoutMs = 3000): Promise<Msg> {
      const found = messages.find(pred);
      if (found) return Promise.resolve(found);
      return new Promise<Msg>((resolve, reject) => {
        const w = { pred, resolve };
        waiters.push(w);
        setTimeout(() => {
          const i = waiters.indexOf(w);
          if (i >= 0) {
            waiters.splice(i, 1);
            reject(new Error("timeout waiting for message"));
          }
        }, timeoutMs);
      });
    },
  };
}

async function connectClient(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  return ws;
}

describe("Dynamic registration + health loop (Phase 9)", () => {
  let broker: Broker | undefined;
  let backend: MockFlask | undefined;
  let client: WebSocket | undefined;
  let baseHttp = "";

  async function boot(): Promise<number> {
    broker = new Broker({ registry: new Registry() });
    const port = await broker.listen("127.0.0.1", 0);
    baseHttp = `http://127.0.0.1:${port}`;
    return port;
  }

  afterEach(async () => {
    client?.close();
    await broker?.close();
    await backend?.close();
    broker = backend = client = undefined;
  });

  it("POST /register builds + probes a service and broadcasts service_update(ready)", async () => {
    backend = await startMockFlask();
    const port = await boot();
    client = await connectClient(port);
    const collect = collector(client);
    client.send(JSON.stringify({ type: "hello", clientId: "t", version: "0" } satisfies WSHello));

    const res = await fetch(`${baseHttp}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "knowledge", adapterType: "flask-http", endpoint: { local: backend.baseUrl }, healthProbe: "GET /skills" }),
    });
    const json = (await res.json()) as { ok: boolean; status: string };
    expect(json.ok).toBe(true);
    expect(json.status).toBe("ready");
    expect(broker!.registry.get("knowledge")?.status).toBe("ready");

    const update = await collect.waitFor((m) => m.type === "service_update" && m.service === "knowledge" && m.status === "ready");
    expect(update.status).toBe("ready");
  });

  it("POST /deregister removes the service and broadcasts service_update(stopped)", async () => {
    backend = await startMockFlask();
    const port = await boot();
    client = await connectClient(port);
    const collect = collector(client);
    client.send(JSON.stringify({ type: "hello", clientId: "t", version: "0" } satisfies WSHello));

    await broker!.register({ id: "knowledge", adapterType: "flask-http", endpoint: { local: backend.baseUrl }, healthProbe: "GET /skills" });

    const res = await fetch(`${baseHttp}/deregister`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "knowledge" }),
    });
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    expect(broker!.registry.has("knowledge")).toBe(false);

    const update = await collect.waitFor((m) => m.type === "service_update" && m.service === "knowledge" && m.status === "stopped");
    expect(update.status).toBe("stopped");
  });

  it("GET /services returns the live registry snapshot", async () => {
    backend = await startMockFlask();
    await boot();
    await broker!.register({ id: "knowledge", adapterType: "flask-http", endpoint: { local: backend.baseUrl }, healthProbe: "GET /skills" });
    const res = await fetch(`${baseHttp}/services`);
    const list = (await res.json()) as Array<{ id: string }>;
    expect(list.map((s) => s.id)).toContain("knowledge");
  });

  it("runHealthCheck() flips status to error when a backend goes down", async () => {
    backend = await startMockFlask();
    const port = await boot();
    client = await connectClient(port);
    const collect = collector(client);
    client.send(JSON.stringify({ type: "hello", clientId: "t", version: "0" } satisfies WSHello));

    await broker!.register({ id: "knowledge", adapterType: "flask-http", endpoint: { local: backend.baseUrl }, healthProbe: "GET /skills" });
    expect(broker!.registry.get("knowledge")?.status).toBe("ready");

    await backend.close();
    backend = undefined;
    await broker!.runHealthCheck();

    expect(broker!.registry.get("knowledge")?.status).toBe("error");
    const update = await collect.waitFor((m) => m.type === "service_update" && m.service === "knowledge" && m.status === "error");
    expect(update.status).toBe("error");
  });
});
