/**
 * DaemonClient — the shared client for every Prism surface (VS Code, Electron,
 * Mobile, Web). Connects to the broker, completes the hello/welcome handshake,
 * keeps a live service registry, and exposes unary `call` + streaming.
 */
import { randomUUID } from "node:crypto";
import { WebSocket, type RawData } from "ws";
import type {
  BrokerEnvelope,
  BrokerResponse,
  ServiceDescriptor,
  ServiceId,
  ServiceStreamMessage,
  ServiceUpdate,
  WSHello,
  WSWelcome,
} from "./protocol";

const CONNECT_TIMEOUT_MS = 5000;

export interface DaemonClientOptions {
  url: string;
  clientId?: string;
  version?: string;
  caps?: string[];
}

export type ServiceUpdateHandler = (update: ServiceUpdate) => void;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

interface StreamSink {
  push: (frame: ServiceStreamMessage) => void;
  end: () => void;
  fail: (err: Error) => void;
}

export class DaemonClient {
  private ws?: WebSocket;
  private connecting?: Promise<void>;
  private sessionId?: string;
  private brokerVersion?: string;
  private readonly services = new Map<ServiceId, ServiceDescriptor>();
  private readonly pending = new Map<string, Pending>();
  private readonly sinks = new Map<string, StreamSink>();
  private readonly updateHandlers = new Set<ServiceUpdateHandler>();

  constructor(private readonly opts: DaemonClientOptions) {}

  connect(): Promise<void> {
    if (this.sessionId) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.opts.url);
      this.ws = ws;
      const timer = setTimeout(() => {
        ws.terminate();
        this.connecting = undefined;
        reject(new Error(`DaemonClient: connect timed out after ${CONNECT_TIMEOUT_MS}ms`));
      }, CONNECT_TIMEOUT_MS);

      const onError = (err: Error) => {
        clearTimeout(timer);
        this.connecting = undefined;
        reject(err);
      };
      ws.once("error", onError);
      ws.once("open", () => {
        const hello: WSHello = {
          type: "hello",
          clientId: this.opts.clientId ?? "prism-client",
          version: this.opts.version ?? "0.1.0",
          caps: this.opts.caps,
        };
        ws.send(JSON.stringify(hello));
      });
      ws.on("message", (data: RawData) => {
        this.onMessage(data.toString(), () => {
          clearTimeout(timer);
          ws.off("error", onError);
          resolve();
        });
      });
      ws.on("close", () => {
        this.sessionId = undefined;
        this.failAll(new Error("DaemonClient: connection closed"));
      });
    });
    return this.connecting;
  }

  private onMessage(text: string, onWelcome: () => void): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return;
    }
    switch (msg.type) {
      case "welcome": {
        const w = msg as unknown as WSWelcome;
        this.sessionId = w.sessionId;
        this.brokerVersion = w.brokerVersion;
        this.services.clear();
        for (const s of w.services) this.services.set(s.id, s);
        this.connecting = undefined;
        onWelcome();
        return;
      }
      case "response": {
        const r = msg as unknown as BrokerResponse;
        const p = this.pending.get(r.id);
        if (p) {
          this.pending.delete(r.id);
          if (r.ok) p.resolve(r.result);
          else p.reject(new Error(r.error?.message ?? "call failed"));
          return;
        }
        const sink = this.sinks.get(r.id);
        if (sink) {
          if (r.ok) sink.end();
          else sink.fail(new Error(r.error?.message ?? "stream failed"));
        }
        return;
      }
      case "service_stream": {
        const s = msg as unknown as ServiceStreamMessage;
        this.sinks.get(s.id)?.push(s);
        return;
      }
      case "service_update": {
        const u = msg as unknown as ServiceUpdate;
        const existing = this.services.get(u.service);
        if (u.status === "stopped") {
          this.services.delete(u.service);
        } else if (existing) {
          this.services.set(u.service, { ...existing, status: u.status, capabilities: u.capabilities ?? existing.capabilities });
        } else {
          // brand-new service registered at runtime (partial info from the wire)
          this.services.set(u.service, {
            id: u.service,
            name: u.service,
            status: u.status,
            capabilities: u.capabilities ?? [],
          });
        }
        for (const h of this.updateHandlers) h(u);
        return;
      }
      default:
        return;
    }
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    for (const s of this.sinks.values()) s.fail(err);
    this.sinks.clear();
  }

  private send(obj: unknown): void {
    if (!this.ws) throw new Error("DaemonClient: not connected");
    this.ws.send(JSON.stringify(obj));
  }

  /** Snapshot of the services advertised by the broker. */
  getServices(): ServiceDescriptor[] {
    return [...this.services.values()];
  }

  get version(): string | undefined {
    return this.brokerVersion;
  }

  onServiceUpdate(handler: ServiceUpdateHandler): () => void {
    this.updateHandlers.add(handler);
    return () => this.updateHandlers.delete(handler);
  }

  async call(service: ServiceId, method: string, payload?: unknown): Promise<unknown> {
    await this.connect();
    const id = randomUUID();
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const env: BrokerEnvelope = { id, service, method, payload, ts: Date.now() };
      this.send(env);
    });
  }

  stream(service: ServiceId, method: string, payload?: unknown): AsyncIterable<ServiceStreamMessage> {
    const id = randomUUID();
    const buffer: ServiceStreamMessage[] = [];
    let ended = false;
    let failure: Error | undefined;
    let pending: ((r: IteratorResult<ServiceStreamMessage>) => void) | undefined;
    let pendingFail: ((e: Error) => void) | undefined;
    let started = false;

    const sink: StreamSink = {
      push: (frame) => {
        if (pending) {
          const p = pending;
          pending = undefined;
          pendingFail = undefined;
          p({ value: frame, done: false });
        } else {
          buffer.push(frame);
        }
      },
      end: () => {
        ended = true;
        if (pending) {
          const p = pending;
          pending = undefined;
          pendingFail = undefined;
          p({ value: undefined as unknown as ServiceStreamMessage, done: true });
        }
      },
      fail: (err) => {
        failure = err;
        ended = true;
        if (pendingFail) {
          const f = pendingFail;
          pending = undefined;
          pendingFail = undefined;
          f(err);
        }
      },
    };

    const self = this;
    const iterator: AsyncIterator<ServiceStreamMessage> = {
      async next(): Promise<IteratorResult<ServiceStreamMessage>> {
        if (!started) {
          started = true;
          await self.connect();
          self.sinks.set(id, sink);
          const env: BrokerEnvelope = { id, service, method, payload, stream: true, ts: Date.now() };
          self.send(env);
        }
        if (buffer.length > 0) return { value: buffer.shift()!, done: false };
        if (failure) {
          const e = failure;
          failure = undefined;
          throw e;
        }
        if (ended) return { value: undefined as unknown as ServiceStreamMessage, done: true };
        return new Promise<IteratorResult<ServiceStreamMessage>>((resolve, reject) => {
          pending = resolve;
          pendingFail = reject;
        });
      },
      async return(): Promise<IteratorResult<ServiceStreamMessage>> {
        self.sinks.delete(id);
        ended = true;
        return { value: undefined as unknown as ServiceStreamMessage, done: true };
      },
    };
    return { [Symbol.asyncIterator]: () => iterator };
  }

  close(): void {
    this.sessionId = undefined;
    this.connecting = undefined;
    this.ws?.close();
    this.ws = undefined;
  }
}
