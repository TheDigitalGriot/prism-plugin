import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";
import { createClientChannel, generateKeyPair, exportPublicKey, type Transport } from "@prism/relay";
import { Broker } from "./broker";
import { Registry } from "./registry";
import type { ServiceDescriptor } from "./protocol";

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
          res.end(JSON.stringify({ echo: body ? JSON.parse(body) : null }));
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

function knowledgeDesc(baseUrl: string): ServiceDescriptor {
  return {
    id: "knowledge",
    name: "knowledge",
    status: "stopped",
    adapterType: "flask-http",
    endpoint: { local: baseUrl },
    capabilities: [],
    healthProbe: "GET /skills",
  };
}

function safeType(data: unknown): string | undefined {
  if (typeof data !== "string") return undefined;
  try {
    return (JSON.parse(data) as { type?: string }).type;
  } catch {
    return undefined;
  }
}

function nextFrame(ws: WebSocket, pred: (f: Record<string, unknown>) => boolean, timeoutMs = 3000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off("message", onMsg);
      reject(new Error("timeout waiting for relay frame"));
    }, timeoutMs);
    const onMsg = (d: Buffer | ArrayBuffer | Buffer[]) => {
      let f: Record<string, unknown>;
      try {
        f = JSON.parse(d.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      if (pred(f)) {
        clearTimeout(timer);
        ws.off("message", onMsg);
        resolve(f);
      }
    };
    ws.on("message", onMsg);
  });
}

describe("Relay bridge (Phase 7)", () => {
  let broker: Broker | undefined;
  let backend: MockFlask | undefined;
  let relayServer: WebSocketServer | undefined;

  afterEach(async () => {
    await broker?.close();
    await backend?.close();
    if (relayServer) await new Promise<void>((r) => relayServer!.close(() => r()));
    broker = backend = relayServer = undefined;
  });

  it("bridges a remote channel through a virtual session (hello→welcome, envelope→response)", async () => {
    backend = await startMockFlask();
    const registry = new Registry();
    registry.upsert(knowledgeDesc(backend.baseUrl));
    broker = new Broker({ registry });

    relayServer = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise<void>((r) => relayServer!.on("listening", () => r()));
    const relayPort = (relayServer.address() as AddressInfo).port;

    const brokerSocketP = new Promise<WebSocket>((resolve) => relayServer!.on("connection", (ws) => resolve(ws)));
    await broker.connectRelay(`ws://127.0.0.1:${relayPort}`);
    const relayConn = await brokerSocketP; // the broker's outbound socket, server side

    // Open a remote channel and send a hello; expect the welcome forwarded back.
    const welcomeP = nextFrame(relayConn, (f) => f.t === "msg" && f.ch === "c1" && safeType(f.data) === "welcome");
    relayConn.send(JSON.stringify({ t: "open", ch: "c1" }));
    relayConn.send(JSON.stringify({ t: "msg", ch: "c1", data: JSON.stringify({ type: "hello", clientId: "remote", version: "0" }) }));
    const welcomeFrame = await welcomeP;
    const welcome = JSON.parse(welcomeFrame.data as string) as { services: Array<{ id: string }> };
    expect(welcome.services.map((s) => s.id)).toContain("knowledge");

    // Send a service call over the channel; expect the response forwarded back.
    const respP = nextFrame(relayConn, (f) => f.t === "msg" && f.ch === "c1" && safeType(f.data) === "response");
    relayConn.send(JSON.stringify({ t: "msg", ch: "c1", data: JSON.stringify({ id: "r1", service: "knowledge", method: "query", payload: { q: 1 }, ts: 1 }) }));
    const respFrame = await respP;
    const resp = JSON.parse(respFrame.data as string) as { ok: boolean; result: { echo: unknown } };
    expect(resp.ok).toBe(true);
    expect(resp.result.echo).toEqual({ q: 1 });
  });

  it("E2EE: a remote client pairs via the daemon pubkey and exchanges encrypted envelopes", async () => {
    backend = await startMockFlask();
    const registry = new Registry();
    registry.upsert(knowledgeDesc(backend.baseUrl));
    broker = new Broker({ registry });

    relayServer = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise<void>((r) => relayServer!.on("listening", () => r()));
    const relayPort = (relayServer.address() as AddressInfo).port;

    const brokerSocketP = new Promise<WebSocket>((resolve) => relayServer!.on("connection", (ws) => resolve(ws)));

    // Broker dials out with an E2EE keypair; the client will pair via its public key.
    const daemonKeyPair = generateKeyPair();
    await broker.connectRelay(`ws://127.0.0.1:${relayPort}`, { daemonKeyPair });
    const daemonPubB64 = exportPublicKey(daemonKeyPair.publicKey);
    const relayConn = await brokerSocketP;

    // Simulate the remote client on the relay-server side: a Transport over channel "e1".
    const clientTransport: Transport = {
      onmessage: null,
      onclose: null,
      onerror: null,
      send: (data) => relayConn.send(JSON.stringify({ t: "msg", ch: "e1", data: typeof data === "string" ? data : "" })),
      close: () => relayConn.send(JSON.stringify({ t: "close", ch: "e1" })),
    };
    // Route broker->client frames on channel e1 into the client transport.
    relayConn.on("message", (d) => {
      let f: Record<string, unknown>;
      try {
        f = JSON.parse(d.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      if (f.t === "msg" && f.ch === "e1" && typeof f.data === "string") clientTransport.onmessage?.(f.data);
    });

    // Open the channel, then run the client-side ECDH handshake.
    relayConn.send(JSON.stringify({ t: "open", ch: "e1" }));
    const clientMsgs: string[] = [];
    const clientChannel = await createClientChannel(clientTransport, daemonPubB64, {
      onmessage: (d) => clientMsgs.push(typeof d === "string" ? d : ""),
    });
    await waitFor(() => clientChannel.isOpen());

    // Encrypted broker hello -> expect an encrypted welcome carrying the registry.
    await clientChannel.send(JSON.stringify({ type: "hello", clientId: "remote", version: "0" }));
    await waitFor(() => clientMsgs.some((m) => safeType(m) === "welcome"));
    const welcome = JSON.parse(clientMsgs.find((m) => safeType(m) === "welcome")!) as { services: Array<{ id: string }> };
    expect(welcome.services.map((s) => s.id)).toContain("knowledge");

    // Encrypted service call -> encrypted response.
    await clientChannel.send(JSON.stringify({ id: "r1", service: "knowledge", method: "query", payload: { q: 7 }, ts: 1 }));
    await waitFor(() => clientMsgs.some((m) => safeType(m) === "response"));
    const resp = JSON.parse(clientMsgs.find((m) => safeType(m) === "response")!) as { ok: boolean; result: { echo: unknown } };
    expect(resp.ok).toBe(true);
    expect(resp.result.echo).toEqual({ q: 7 });
  });
});

async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 10));
  }
}
