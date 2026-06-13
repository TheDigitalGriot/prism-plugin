/**
 * WebSocketAdapter — generic JSON-over-WebSocket transport for a backend that
 * speaks the broker's clean dialect:
 *   client -> { type:"hello", clientId, version }
 *   server -> { type:"welcome", capabilities?: SkillManifestEntry[] }
 *   client -> { type:"request", id, method, payload, stream? }
 *   server -> { type:"response", id, ok, result?, error? }
 *   server -> { type:"stream", id, seq, kind, event }   (repeated)
 *   server -> { type:"stream_end", id }
 *
 * NOTE (tracked follow-up): paseo's native daemon protocol differs from this
 * dialect. Pointing agent-run at the live paseo daemon (:6767) requires a thin
 * paseo-dialect translation (a per-service relay, same shape as design-studio).
 */
import { randomUUID } from "node:crypto";
import { WebSocket, type RawData } from "ws";
import type { ServiceDescriptor, SkillManifestEntry } from "../protocol";
import type { Adapter, ProbeResult, StreamEvent } from "./types";

const CONNECT_TIMEOUT_MS = 5000;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

interface StreamSink {
  push: (ev: StreamEvent) => void;
  end: () => void;
  fail: (err: Error) => void;
}

export class WebSocketAdapter implements Adapter {
  readonly type = "websocket" as const;
  private readonly url: string;
  private ws?: WebSocket;
  private connecting?: Promise<void>;
  private connected = false;
  private capabilities: SkillManifestEntry[] = [];
  private readonly pending = new Map<string, Pending>();
  private readonly sinks = new Map<string, StreamSink>();

  constructor(private readonly desc: ServiceDescriptor) {
    const url = desc.endpoint.local ?? desc.endpoint.cloud;
    if (!url) throw new Error(`WebSocketAdapter: service '${desc.id}' has no endpoint`);
    this.url = url;
  }

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`WebSocketAdapter: '${this.desc.id}' connect timed out after ${CONNECT_TIMEOUT_MS}ms`));
      }, CONNECT_TIMEOUT_MS);

      const settleReject = (err: Error) => {
        clearTimeout(timer);
        this.connecting = undefined;
        reject(err);
      };

      ws.once("error", settleReject);
      ws.once("open", () => {
        ws.send(JSON.stringify({ type: "hello", clientId: "prism-daemon", version: "0.1.0" }));
      });
      ws.on("message", (data: RawData) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(data.toString()) as Record<string, unknown>;
        } catch {
          return;
        }
        if (msg.type === "welcome" && !this.connected) {
          clearTimeout(timer);
          ws.off("error", settleReject);
          this.connected = true;
          this.capabilities = Array.isArray(msg.capabilities) ? (msg.capabilities as SkillManifestEntry[]) : [];
          this.connecting = undefined;
          resolve();
          return;
        }
        this.dispatch(msg);
      });
      ws.on("close", () => {
        this.connected = false;
        this.failAll(new Error(`WebSocketAdapter: '${this.desc.id}' connection closed`));
      });
    });
    return this.connecting;
  }

  private dispatch(msg: Record<string, unknown>): void {
    const id = typeof msg.id === "string" ? msg.id : undefined;
    if (!id) return;
    if (msg.type === "response") {
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(((msg.error as { message?: string })?.message) ?? "adapter call failed"));
      return;
    }
    if (msg.type === "stream") {
      this.sinks.get(id)?.push({
        seq: typeof msg.seq === "number" ? msg.seq : 0,
        kind: typeof msg.kind === "string" ? msg.kind : "data",
        data: msg.event,
      });
      return;
    }
    if (msg.type === "stream_end") {
      this.sinks.get(id)?.end();
    }
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    for (const s of this.sinks.values()) s.fail(err);
    this.sinks.clear();
  }

  private send(obj: unknown): void {
    if (!this.ws) throw new Error(`WebSocketAdapter: '${this.desc.id}' not connected`);
    this.ws.send(JSON.stringify(obj));
  }

  async probe(): Promise<ProbeResult> {
    const start = Date.now();
    try {
      await this.connect();
      return { ok: true, via: "local", latencyMs: Date.now() - start, manifest: this.capabilities };
    } catch {
      return { ok: false, via: "local", latencyMs: Date.now() - start };
    }
  }

  async describe(): Promise<SkillManifestEntry[]> {
    await this.connect();
    return this.capabilities;
  }

  async call(method: string, payload: unknown): Promise<unknown> {
    await this.connect();
    const id = randomUUID();
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ type: "request", id, method, payload });
    });
  }

  stream(method: string, payload: unknown): AsyncIterable<StreamEvent> {
    const id = randomUUID();
    const buffer: StreamEvent[] = [];
    let ended = false;
    let failure: Error | undefined;
    let pending: ((r: IteratorResult<StreamEvent>) => void) | undefined;
    let pendingFail: ((e: Error) => void) | undefined;
    let started = false;

    const sink: StreamSink = {
      push: (ev) => {
        if (pending) {
          const p = pending;
          pending = undefined;
          pendingFail = undefined;
          p({ value: ev, done: false });
        } else {
          buffer.push(ev);
        }
      },
      end: () => {
        ended = true;
        if (pending) {
          const p = pending;
          pending = undefined;
          pendingFail = undefined;
          p({ value: undefined as unknown as StreamEvent, done: true });
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
    const iterator: AsyncIterator<StreamEvent> = {
      async next(): Promise<IteratorResult<StreamEvent>> {
        if (!started) {
          started = true;
          await self.connect();
          self.sinks.set(id, sink);
          self.send({ type: "request", id, method, payload, stream: true });
        }
        if (buffer.length > 0) return { value: buffer.shift()!, done: false };
        if (failure) {
          const e = failure;
          failure = undefined;
          throw e;
        }
        if (ended) return { value: undefined as unknown as StreamEvent, done: true };
        return new Promise<IteratorResult<StreamEvent>>((resolve, reject) => {
          pending = resolve;
          pendingFail = reject;
        });
      },
      async return(): Promise<IteratorResult<StreamEvent>> {
        self.sinks.delete(id);
        ended = true;
        return { value: undefined as unknown as StreamEvent, done: true };
      },
    };
    return { [Symbol.asyncIterator]: () => iterator };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.connecting = undefined;
    this.ws?.close();
    this.ws = undefined;
  }
}
