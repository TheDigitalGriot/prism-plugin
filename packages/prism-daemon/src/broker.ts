/**
 * Broker — the thin spine. Owns an HTTP+WS server, completes the hello/welcome
 * handshake (welcome ships the live registry snapshot), builds one adapter per
 * registered service, and routes service calls (unary) / streams.
 * It routes and discovers; the real work lives in the backends behind adapters.
 *
 * Spec: .prism/shared/designs/2026-06-12-daemon-broker-design.md (§2, §3, §5)
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket, type RawData } from "ws";
import { Registry } from "./registry";
import { Router } from "./router";
import { Session } from "./session";
import { createAdapter, type Adapter } from "./adapters";
import { resolveEndpoint, type ResolveOptions } from "./resolve";
import { RelayClient } from "./relay";
import {
  errorResponse,
  isEnvelope,
  isHello,
  okResponse,
  type BrokerEnvelope,
  type ServiceDescriptor,
  type ServiceId,
  type ServiceStreamMessage,
  type ServiceUpdate,
  type WSWelcome,
} from "./protocol";

export const BROKER_VERSION = "0.1.0";

export interface BrokerOptions {
  registry?: Registry;
}

export interface RegisterInput {
  id: string;
  name?: string;
  adapterType: ServiceDescriptor["adapterType"];
  endpoint?: ServiceDescriptor["endpoint"];
  capabilities?: ServiceDescriptor["capabilities"];
  healthProbe?: string;
  gate?: ServiceDescriptor["gate"];
  spawnCmd?: string;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString()));
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err as Error);
      }
    });
    req.on("error", reject);
  });
}

export class Broker {
  readonly registry: Registry;
  private readonly router: Router;
  private readonly http: Server;
  private readonly wss: WebSocketServer;
  private readonly sessions = new Map<string, Session>();
  /** Every connected client's send sink (LAN ws + relay channels) — broadcast target. */
  private readonly outbound = new Set<(obj: unknown) => void>();
  private healthTimer?: NodeJS.Timeout;
  private relay?: RelayClient;

  constructor(opts: BrokerOptions = {}) {
    this.registry = opts.registry ?? new Registry();
    this.router = new Router(this.registry);
    this.wireAdapters();
    this.http = createServer((req, res) => void this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.http });
    this.wss.on("connection", (ws) => this.onConnection(ws));
  }

  /** Build one adapter per registered service. Unknown adapter types are skipped (status: error). */
  private wireAdapters(): void {
    for (const desc of this.registry.snapshot()) {
      try {
        this.router.setAdapter(desc.id, createAdapter(desc));
      } catch (err) {
        this.registry.setStatus(desc.id, "error");
        console.error(
          `[prism-daemon] no adapter for service '${desc.id}':`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  /**
   * Optional boot-readiness pass: resolve each URL-based service's endpoint
   * (try-local→cloud), (re)build its adapter against the resolved URL, probe it,
   * and record status + lastProbe. Runs all services in parallel. Pure-local
   * usage (e.g. unit tests) can skip this and rely on the constructor's wiring.
   */
  async init(opts: ResolveOptions = {}): Promise<void> {
    await Promise.all(this.registry.snapshot().map((desc) => this.resolveAndProbe(desc, opts)));
  }

  private async resolveAndProbe(desc: ServiceDescriptor, opts: ResolveOptions): Promise<void> {
    let via: "local" | "cloud" = "local";
    if (desc.endpoint.local || desc.endpoint.cloud) {
      let resolved: { url: string; via: "local" | "cloud" };
      try {
        resolved = await resolveEndpoint(desc, opts);
      } catch {
        this.registry.setStatus(desc.id, "error");
        return;
      }
      via = resolved.via;
      const resolvedDesc: ServiceDescriptor = { ...desc, endpoint: { ...desc.endpoint, local: resolved.url } };
      try {
        this.router.setAdapter(desc.id, createAdapter(resolvedDesc));
      } catch {
        this.registry.setStatus(desc.id, "error");
        return;
      }
    }
    const adapter = this.router.adapterFor(desc.id);
    if (!adapter) {
      this.registry.setStatus(desc.id, "error");
      return;
    }
    const probe = await adapter.probe();
    const stored = this.registry.get(desc.id);
    if (!stored) return;
    stored.status = probe.ok ? "ready" : "error";
    if (probe.manifest && probe.manifest.length > 0) stored.capabilities = probe.manifest;
    stored.lastProbe = { at: Date.now(), ok: probe.ok, latencyMs: probe.latencyMs, via };
  }

  // ── Dynamic registration (Phase 9) ──────────────────────────────────────────

  /** HTTP control plane: POST /register, POST /deregister, GET /services. */
  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      const url = req.url ?? "/";
      if (req.method === "GET" && url === "/health") {
        const snap = this.registry.snapshot();
        send(200, {
          ok: true,
          version: BROKER_VERSION,
          serviceCount: snap.length,
          ready: snap.filter((s) => s.status === "ready").length,
        });
        return;
      }
      if (req.method === "GET" && url === "/services") {
        send(200, this.registry.snapshot());
        return;
      }
      if (req.method === "POST" && url === "/register") {
        const body = (await readJsonBody(req)) as RegisterInput;
        if (!body.id || !body.adapterType) {
          send(400, { ok: false, error: "register requires { id, adapterType }" });
          return;
        }
        const desc = await this.register(body);
        send(200, { ok: true, id: desc.id, status: desc.status });
        return;
      }
      if (req.method === "POST" && url === "/deregister") {
        const body = (await readJsonBody(req)) as { id?: string };
        if (!body.id) {
          send(400, { ok: false, error: "deregister requires { id }" });
          return;
        }
        const removed = await this.deregister(body.id);
        send(200, { ok: removed });
        return;
      }
      if (req.method === "POST" && url === "/call") {
        const body = (await readJsonBody(req)) as { service?: string; method?: string; payload?: unknown };
        if (!body.service || !body.method) {
          send(400, { ok: false, error: "call requires { service, method }" });
          return;
        }
        const res = await this.router.route({ id: randomUUID(), service: body.service, method: body.method, payload: body.payload, ts: Date.now() });
        if (res.ok) send(200, { ok: true, result: res.result });
        else send(502, { ok: false, error: res.error });
        return;
      }
      send(404, { ok: false, error: "not found" });
    } catch (err) {
      send(400, { ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  /** Register (or replace) a service at runtime: build adapter → probe → broadcast. */
  async register(input: RegisterInput): Promise<ServiceDescriptor> {
    const desc: ServiceDescriptor = {
      id: input.id,
      name: input.name ?? input.id,
      status: "starting",
      adapterType: input.adapterType,
      endpoint: input.endpoint ?? {},
      capabilities: input.capabilities ?? [],
      healthProbe: input.healthProbe ?? "",
      gate: input.gate,
      spawnCmd: input.spawnCmd,
    };
    this.registry.upsert(desc);
    let adapter: Adapter;
    try {
      adapter = createAdapter(desc);
    } catch (err) {
      this.registry.setStatus(desc.id, "error");
      this.broadcastServiceUpdate(desc.id);
      throw err;
    }
    this.router.setAdapter(desc.id, adapter);
    const probe = await adapter.probe();
    const stored = this.registry.get(desc.id);
    if (stored) {
      stored.status = probe.ok ? "ready" : "error";
      if (probe.manifest && probe.manifest.length > 0) stored.capabilities = probe.manifest;
      stored.lastProbe = { at: Date.now(), ok: probe.ok, latencyMs: probe.latencyMs, via: "local" };
    }
    this.broadcastServiceUpdate(desc.id);
    return this.registry.get(desc.id) ?? desc;
  }

  async deregister(id: ServiceId): Promise<boolean> {
    const adapter = this.router.adapterFor(id);
    if (adapter) await adapter.disconnect().catch(() => undefined);
    this.router.removeAdapter(id);
    const existed = this.registry.remove(id);
    if (existed) {
      this.broadcast({ type: "service_update", service: id, status: "stopped" } satisfies ServiceUpdate);
    }
    return existed;
  }

  private broadcastServiceUpdate(id: ServiceId): void {
    const desc = this.registry.get(id);
    if (!desc) return;
    this.broadcast({
      type: "service_update",
      service: id,
      status: desc.status,
      capabilities: desc.capabilities,
    } satisfies ServiceUpdate);
  }

  private broadcast(msg: unknown): void {
    for (const send of this.outbound) send(msg);
  }

  // ── Health loop (Phase 9) ────────────────────────────────────────────────────

  /** Probe every service once; on a status change, broadcast a service_update. */
  async runHealthCheck(): Promise<void> {
    await Promise.all(
      this.registry.snapshot().map(async (desc) => {
        const adapter = this.router.adapterFor(desc.id);
        if (!adapter) return;
        const probe = await adapter.probe();
        const stored = this.registry.get(desc.id);
        if (!stored) return;
        const next = probe.ok ? "ready" : "error";
        if (stored.status !== next) {
          stored.status = next;
          stored.lastProbe = {
            at: Date.now(),
            ok: probe.ok,
            latencyMs: probe.latencyMs,
            via: stored.lastProbe?.via ?? "local",
          };
          this.broadcastServiceUpdate(desc.id);
        }
      }),
    );
  }

  startHealthLoop(intervalMs = 15_000): void {
    if (this.healthTimer) return;
    this.healthTimer = setInterval(() => void this.runHealthCheck(), intervalMs);
    this.healthTimer.unref();
  }

  /**
   * Transport-agnostic per-client session logic, driven by a `send` sink. Used by
   * both the direct WS path (onConnection) and relay-bridged channels.
   */
  private createSessionHandler(send: (obj: unknown) => void): { feed: (text: string) => void; dispose: () => void } {
    this.outbound.add(send);
    let session: Session | undefined;

    const feed = (text: string): void => {
      let msg: unknown;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (!session) {
        if (isHello(msg)) {
          session = new Session(randomUUID(), msg.clientId, msg.version, msg.caps ?? []);
          this.sessions.set(session.sessionId, session);
          send({
            type: "welcome",
            brokerVersion: BROKER_VERSION,
            sessionId: session.sessionId,
            services: this.registry.snapshot(),
            capabilities: [],
          } satisfies WSWelcome);
        }
        return;
      }
      if (isEnvelope(msg)) {
        if (msg.stream) void this.handleStream(send, msg);
        else void this.router.route(msg).then(send);
      }
    };

    const dispose = (): void => {
      this.outbound.delete(send);
      if (session) this.sessions.delete(session.sessionId);
    };

    return { feed, dispose };
  }

  private onConnection(ws: WebSocket): void {
    const send = (obj: unknown): void => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
    };
    const handler = this.createSessionHandler(send);
    ws.on("message", (data: RawData) => handler.feed(data.toString()));
    ws.on("close", () => handler.dispose());
  }

  /** Dial the self-hosted relay so remote clients can reach this broker (no inbound port). */
  async connectRelay(url: string): Promise<void> {
    this.relay = new RelayClient({ url, onChannel: (send) => this.createSessionHandler(send) });
    await this.relay.connect();
  }

  /** QR-encodable pairing payload. NOTE: E2EE pubkey pairing (paseo's relay) is a follow-up. */
  pairingInfo(relayUrl: string): { relayUrl: string; token: string } {
    return { relayUrl, token: randomUUID() };
  }

  private async handleStream(send: (obj: unknown) => void, env: BrokerEnvelope): Promise<void> {
    if (!this.registry.has(env.service)) {
      send(errorResponse(env.id, { code: "SERVICE_NOT_FOUND", service: env.service, message: `No service '${env.service}'` }));
      return;
    }
    const adapter = this.router.adapterFor(env.service);
    if (!adapter) {
      send(errorResponse(env.id, { code: "SERVICE_UNAVAILABLE", service: env.service, message: `Service '${env.service}' has no adapter wired` }));
      return;
    }
    try {
      for await (const ev of adapter.stream(env.method, env.payload)) {
        const frame: ServiceStreamMessage = { type: "service_stream", service: env.service, id: env.id, seq: ev.seq, event: ev.data };
        send(frame);
      }
      send(okResponse(env.id, { streamed: true }));
    } catch (err) {
      send(errorResponse(env.id, { code: "ADAPTER_ERROR", service: env.service, message: err instanceof Error ? err.message : String(err) }));
    }
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  listen(host = "127.0.0.1", port = 6780): Promise<number> {
    return new Promise((resolve) => {
      this.http.listen(port, host, () => {
        const addr = this.http.address() as AddressInfo;
        resolve(addr.port);
      });
    });
  }

  async close(): Promise<void> {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
    this.relay?.close();
    this.relay = undefined;
    this.outbound.clear();
    await this.router.disconnectAll();
    for (const client of this.wss.clients) client.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }
}
