/**
 * Broker — the thin spine. Owns an HTTP+WS server, completes the hello/welcome
 * handshake (welcome ships the live registry snapshot), builds one adapter per
 * registered service, and routes service calls (unary) / streams.
 * It routes and discovers; the real work lives in the backends behind adapters.
 *
 * Spec: .prism/shared/designs/2026-06-12-daemon-broker-design.md (§2, §3, §5)
 */
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket, type RawData } from "ws";
import { Registry } from "./registry";
import { Router } from "./router";
import { Session } from "./session";
import { createAdapter } from "./adapters";
import {
  errorResponse,
  isEnvelope,
  isHello,
  okResponse,
  type BrokerEnvelope,
  type ServiceStreamMessage,
  type WSWelcome,
} from "./protocol";

export const BROKER_VERSION = "0.1.0";

export interface BrokerOptions {
  registry?: Registry;
}

export class Broker {
  readonly registry: Registry;
  private readonly router: Router;
  private readonly http: Server;
  private readonly wss: WebSocketServer;
  private readonly sessions = new Map<string, Session>();

  constructor(opts: BrokerOptions = {}) {
    this.registry = opts.registry ?? new Registry();
    this.router = new Router(this.registry);
    this.wireAdapters();
    this.http = createServer();
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

  private onConnection(ws: WebSocket): void {
    let session: Session | undefined;
    const send = (obj: unknown): void => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
    };

    ws.on("message", (data: RawData) => {
      let msg: unknown;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (!session) {
        if (isHello(msg)) {
          session = new Session(randomUUID(), msg.clientId, msg.version, msg.caps ?? []);
          this.sessions.set(session.sessionId, session);
          const welcome: WSWelcome = {
            type: "welcome",
            brokerVersion: BROKER_VERSION,
            sessionId: session.sessionId,
            services: this.registry.snapshot(),
            capabilities: [],
          };
          send(welcome);
        }
        return;
      }

      if (isEnvelope(msg)) {
        if (msg.stream) void this.handleStream(send, msg);
        else void this.router.route(msg).then(send);
      }
    });

    ws.on("close", () => {
      if (session) this.sessions.delete(session.sessionId);
    });
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
    await this.router.disconnectAll();
    for (const client of this.wss.clients) client.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }
}
