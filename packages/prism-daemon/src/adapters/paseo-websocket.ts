/**
 * PaseoWebSocketAdapter — speaks the *paseo* daemon dialect (the live agent
 * daemon at :6767), translating the broker's generic call/stream into paseo's
 * requestId-correlated RPCs + push frames. This is the "paseo-dialect shim":
 * it lets `agent-run` target the REAL paseo daemon (sovereignly absorbed),
 * rather than the broker's clean dialect (WebSocketAdapter).
 *
 * Paseo wire (apps/prism-mobile/packages/server/src/shared/messages.ts):
 *   client -> { type:"hello", clientId, clientType, protocolVersion, appVersion? }
 *   server -> { type:"welcome", sessionId, daemonVersion?, capabilities? }
 *   client -> { type:`${method}_request`,  requestId, ...payload }
 *   server -> { type:`${method}_response`, requestId, ... }       (requestId-correlated)
 *   server -> push frames (timeline / turn_* / agent_*) — surfaced via stream()
 *
 * call("fetch_agents", {})  ->  send fetch_agents_request, await fetch_agents_response.
 * stream("timeline", {...}) ->  forward every push frame whose `type` === "timeline".
 */
import { randomUUID } from "node:crypto";
import { WebSocket, type RawData } from "ws";
import type { ServiceDescriptor, SkillManifestEntry } from "../protocol";
import type { Adapter, ProbeResult, StreamEvent } from "./types";

const CONNECT_TIMEOUT_MS = 5000;
const PROTOCOL_VERSION = 1;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

interface StreamSink {
  push: (ev: StreamEvent) => void;
  end: () => void;
  fail: (err: Error) => void;
}

/** Strip the paseo envelope keys, returning just the payload fields. */
function stripEnvelope(msg: Record<string, unknown>): Record<string, unknown> {
  const { type: _t, requestId: _r, ...rest } = msg;
  void _t;
  void _r;
  return rest;
}

/**
 * The paseo daemon mounts its WebSocket on `/ws` (see packages/server
 * websocket-server.ts: `new WebSocketServer({ path: "/ws" })`). A bare-host URL
 * (`ws://host:6767`) is rejected at the upgrade with HTTP 400. Normalize any
 * path-less endpoint to `/ws`; respect an explicit path if one is already set.
 */
function ensurePaseoWsPath(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.pathname === "" || u.pathname === "/") u.pathname = "/ws";
    return u.toString();
  } catch {
    const trimmed = raw.replace(/\/+$/, "");
    return trimmed.endsWith("/ws") ? trimmed : `${trimmed}/ws`;
  }
}

/**
 * Detect handshake completion. The live paseo daemon does NOT send `{type:"welcome"}`;
 * it completes the hello with a server_info status frame:
 *   {type:"session", message:{type:"status", payload:{status:"server_info", version, serverId}}}
 * Accept that as connected, and keep the `welcome` branch for any clean-dialect daemon.
 */
function detectHandshake(
  msg: Record<string, unknown>,
): { sessionId?: string; daemonVersion?: string } | null {
  if (msg.type === "welcome") {
    return {
      sessionId: typeof msg.sessionId === "string" ? msg.sessionId : undefined,
      daemonVersion: typeof msg.daemonVersion === "string" ? msg.daemonVersion : undefined,
    };
  }
  if (msg.type === "session") {
    const message = msg.message as { type?: unknown; payload?: Record<string, unknown> } | undefined;
    const payload = message?.payload;
    if (message?.type === "status" && payload?.status === "server_info") {
      return {
        sessionId: typeof payload.serverId === "string" ? payload.serverId : undefined,
        daemonVersion: typeof payload.version === "string" ? payload.version : undefined,
      };
    }
  }
  return null;
}

export class PaseoWebSocketAdapter implements Adapter {
  readonly type = "websocket-paseo" as const;
  private readonly url: string;
  private ws?: WebSocket;
  private connecting?: Promise<void>;
  private connected = false;
  private sessionId?: string;
  private daemonVersion?: string;
  private readonly pending = new Map<string, Pending>();
  private readonly typeSinks = new Map<string, Set<StreamSink>>();
  private seq = 0;

  constructor(private readonly desc: ServiceDescriptor) {
    const url = desc.endpoint.local ?? desc.endpoint.cloud;
    if (!url) throw new Error(`PaseoWebSocketAdapter: service '${desc.id}' has no endpoint`);
    this.url = ensurePaseoWsPath(url);
  }

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`PaseoWebSocketAdapter: '${this.desc.id}' connect timed out after ${CONNECT_TIMEOUT_MS}ms`));
      }, CONNECT_TIMEOUT_MS);

      const settleReject = (err: Error) => {
        clearTimeout(timer);
        this.connecting = undefined;
        reject(err);
      };

      ws.once("error", settleReject);
      ws.once("open", () => {
        ws.send(
          JSON.stringify({
            type: "hello",
            clientId: "prism-daemon",
            clientType: "cli",
            protocolVersion: PROTOCOL_VERSION,
            appVersion: "0.1.0",
          }),
        );
      });
      ws.on("message", (data: RawData) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(data.toString()) as Record<string, unknown>;
        } catch {
          return;
        }
        const handshake = !this.connected ? detectHandshake(msg) : null;
        if (handshake) {
          clearTimeout(timer);
          ws.off("error", settleReject);
          this.connected = true;
          this.sessionId = handshake.sessionId;
          this.daemonVersion = handshake.daemonVersion;
          this.connecting = undefined;
          resolve();
          return;
        }
        this.dispatch(msg);
      });
      ws.on("close", () => {
        this.connected = false;
        this.failAll(new Error(`PaseoWebSocketAdapter: '${this.desc.id}' connection closed`));
      });
    });
    return this.connecting;
  }

  private dispatch(msg: Record<string, unknown>): void {
    // RPC response — paseo correlates by requestId, not message type.
    const requestId = typeof msg.requestId === "string" ? msg.requestId : undefined;
    if (requestId && this.pending.has(requestId)) {
      const p = this.pending.get(requestId)!;
      this.pending.delete(requestId);
      if (msg.error !== undefined && msg.error !== null) {
        p.reject(new Error(typeof msg.error === "string" ? msg.error : JSON.stringify(msg.error)));
      } else {
        p.resolve(stripEnvelope(msg));
      }
      return;
    }
    // Push frame — forward to any stream subscribed to this message type.
    const type = typeof msg.type === "string" ? msg.type : undefined;
    if (!type) return;
    const sinks = this.typeSinks.get(type);
    if (sinks) {
      const ev: StreamEvent = { seq: this.seq++, kind: type, data: msg };
      for (const s of sinks) s.push(ev);
    }
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    for (const sinks of this.typeSinks.values()) for (const s of sinks) s.fail(err);
    this.typeSinks.clear();
  }

  private send(obj: unknown): void {
    if (!this.ws) throw new Error(`PaseoWebSocketAdapter: '${this.desc.id}' not connected`);
    this.ws.send(JSON.stringify(obj));
  }

  async probe(): Promise<ProbeResult> {
    const start = Date.now();
    try {
      await this.connect();
      return { ok: true, via: "local", latencyMs: Date.now() - start, manifest: this.capabilities() };
    } catch {
      return { ok: false, via: "local", latencyMs: Date.now() - start };
    }
  }

  /** Paseo has no SKILL.md manifest; capabilities are the RPCs the broker maps. */
  private capabilities(): SkillManifestEntry[] {
    return [];
  }

  async describe(): Promise<SkillManifestEntry[]> {
    await this.connect();
    return this.capabilities();
  }

  async call(method: string, payload: unknown): Promise<unknown> {
    await this.connect();
    const requestId = randomUUID();
    const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.send({ type: `${method}_request`, requestId, ...body });
    });
  }

  /**
   * Forward paseo push frames whose `type === method` (e.g. "timeline",
   * "turn_completed", "agent_stream") as StreamEvents. If `payload` is given,
   * a `${method}_request` is sent first to kick the subscription. Open-ended:
   * ends only when the connection closes or the consumer calls return().
   */
  stream(method: string, payload: unknown): AsyncIterable<StreamEvent> {
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
    const register = () => {
      let set = self.typeSinks.get(method);
      if (!set) {
        set = new Set<StreamSink>();
        self.typeSinks.set(method, set);
      }
      set.add(sink);
    };
    const unregister = () => {
      const set = self.typeSinks.get(method);
      set?.delete(sink);
      if (set && set.size === 0) self.typeSinks.delete(method);
    };

    const iterator: AsyncIterator<StreamEvent> = {
      async next(): Promise<IteratorResult<StreamEvent>> {
        if (!started) {
          started = true;
          await self.connect();
          register();
          if (payload && typeof payload === "object") {
            self.send({ type: `${method}_request`, requestId: randomUUID(), ...(payload as Record<string, unknown>) });
          }
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
        unregister();
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
