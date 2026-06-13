import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { Broker, Registry } from "@prism/daemon";
import { DaemonClient } from "./client";

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
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c: Buffer) => (body += c.toString()));
        req.on("end", () => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ echo: body ? JSON.parse(body) : null, path: req.url }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise<void>((d) => server.close(() => d())) });
    });
  });
}

describe("DaemonClient ↔ real Broker (Phase 8 conformance)", () => {
  let broker: Broker | undefined;
  let backend: MockFlask | undefined;
  let client: DaemonClient | undefined;

  async function boot(registry: Registry): Promise<DaemonClient> {
    broker = new Broker({ registry });
    const port = await broker.listen("127.0.0.1", 0);
    client = new DaemonClient({ url: `ws://127.0.0.1:${port}`, clientId: "test" });
    return client;
  }

  function knowledgeDesc(baseUrl: string) {
    return {
      id: "knowledge",
      name: "knowledge",
      status: "stopped" as const,
      adapterType: "flask-http" as const,
      endpoint: { local: baseUrl },
      capabilities: [],
      healthProbe: "GET /skills",
    };
  }

  afterEach(async () => {
    client?.close();
    await broker?.close();
    await backend?.close();
    broker = backend = client = undefined;
  });

  it("connects and mirrors the broker's service registry from welcome", async () => {
    backend = await startMockFlask();
    const registry = new Registry();
    registry.upsert(knowledgeDesc(backend.baseUrl));
    const c = await boot(registry);
    await c.connect();
    expect(c.getServices().map((s) => s.id)).toContain("knowledge");
    expect(c.version).toBe("0.1.0");
  });

  it("call() round-trips client → broker → backend → client", async () => {
    backend = await startMockFlask();
    const registry = new Registry();
    registry.upsert(knowledgeDesc(backend.baseUrl));
    const c = await boot(registry);
    const result = (await c.call("knowledge", "query", { q: "auth" })) as { echo: unknown; path: string };
    expect(result.echo).toEqual({ q: "auth" });
    expect(result.path).toBe("/query");
  });

  it("stream() yields the result frame", async () => {
    backend = await startMockFlask();
    const registry = new Registry();
    registry.upsert(knowledgeDesc(backend.baseUrl));
    const c = await boot(registry);
    const frames: unknown[] = [];
    for await (const frame of c.stream("knowledge", "query", { n: 1 })) frames.push(frame.event);
    expect(frames).toHaveLength(1);
  });

  it("receives a live service_update and adds the new service", async () => {
    backend = await startMockFlask();
    const c = await boot(new Registry());
    await c.connect();
    expect(c.getServices()).toHaveLength(0);

    const got = new Promise<void>((resolve) => {
      const off = c.onServiceUpdate((u) => {
        if (u.service === "knowledge" && u.status === "ready") {
          off();
          resolve();
        }
      });
    });
    await broker!.register({ id: "knowledge", adapterType: "flask-http", endpoint: { local: backend.baseUrl }, healthProbe: "GET /skills" });
    await got;

    expect(c.getServices().map((s) => s.id)).toContain("knowledge");
  });
});
