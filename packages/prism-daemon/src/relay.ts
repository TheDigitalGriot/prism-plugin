/**
 * RelayClient — bridges remote clients to the broker via an outbound WebSocket to
 * a self-hosted relay (e.g. prism.digitalgriot.studio/relay). The broker dials OUT,
 * so no inbound port is exposed. Each remote client is a multiplexed "channel" that
 * the broker treats as a virtual session (same hello/welcome/route logic as LAN).
 *
 * Bridge framing (broker <-> relay):
 *   relay -> broker:  { t:"open", ch } | { t:"msg", ch, data } | { t:"close", ch }
 *   broker -> relay:  { t:"msg", ch, data }
 *
 * E2EE (worklist §I — DONE): when `crypto.daemonKeyPair` is supplied, each channel is
 * wrapped in `@prism/relay`'s zero-knowledge EncryptedChannel (Curve25519 ECDH +
 * NaCl box / XSalsa20-Poly1305). The broker is the daemon side; the remote client
 * pairs via the daemon's public key (QR). Without `crypto`, frames forward in the
 * clear (back-compat). The bridge seam is unchanged either way — only the per-channel
 * transport gets encrypted.
 *
 * Spec: .prism/shared/designs/2026-06-12-daemon-broker-design.md (§7)
 */
import { WebSocket, type RawData } from "ws";
import { createDaemonChannel, type EncryptedChannel, type Transport, type KeyPair } from "@prism/relay";

export interface ChannelHandler {
  feed: (text: string) => void;
  dispose: () => void;
}

export interface RelayCrypto {
  /** Daemon-side keypair; the remote client pairs via exportPublicKey(daemonKeyPair.publicKey). */
  daemonKeyPair: KeyPair;
}

export interface RelayOptions {
  url: string;
  /** Called when a remote channel opens; returns the per-channel session handler. */
  onChannel: (send: (obj: unknown) => void) => ChannelHandler;
  /** When set, every channel is end-to-end encrypted via @prism/relay. */
  crypto?: RelayCrypto;
}

interface ChannelEntry {
  /** Feed a raw relay-frame payload (handshake JSON or base64 ciphertext, or cleartext). */
  feedRaw: (data: string) => void;
  dispose: () => void;
}

export class RelayClient {
  private ws?: WebSocket;
  private readonly channels = new Map<string, ChannelEntry>();

  constructor(private readonly opts: RelayOptions) {}

  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.opts.url);
      this.ws = ws;
      ws.once("error", reject);
      ws.once("open", () => resolve());
      ws.on("message", (data: RawData) => this.onFrame(data.toString()));
      ws.on("close", () => {
        for (const handler of this.channels.values()) handler.dispose();
        this.channels.clear();
      });
    });
  }

  private onFrame(text: string): void {
    let frame: { t?: unknown; ch?: unknown; data?: unknown };
    try {
      frame = JSON.parse(text) as typeof frame;
    } catch {
      return;
    }
    const ch = typeof frame.ch === "string" ? frame.ch : undefined;
    if (!ch) return;

    if (frame.t === "open") {
      if (this.channels.has(ch)) return;
      this.channels.set(ch, this.opts.crypto ? this.openEncrypted(ch, this.opts.crypto) : this.openClear(ch));
    } else if (frame.t === "msg") {
      const data = typeof frame.data === "string" ? frame.data : JSON.stringify(frame.data);
      this.channels.get(ch)?.feedRaw(data);
    } else if (frame.t === "close") {
      this.channels.get(ch)?.dispose();
      this.channels.delete(ch);
    }
  }

  /** Cleartext channel — the session feeds on raw JSON, sends JSON. */
  private openClear(ch: string): ChannelEntry {
    const send = (obj: unknown): void => {
      this.ws?.send(JSON.stringify({ t: "msg", ch, data: JSON.stringify(obj) }));
    };
    const handler = this.opts.onChannel(send);
    return { feedRaw: handler.feed, dispose: handler.dispose };
  }

  /**
   * E2EE channel — raw frames flow into an EncryptedChannel (daemon side); decrypted
   * plaintext feeds the session, and the session's sends are encrypted out. The session
   * handler is created synchronously with an encrypting `send` that buffers until the
   * ECDH handshake completes.
   */
  private openEncrypted(ch: string, crypto: RelayCrypto): ChannelEntry {
    let enc: EncryptedChannel | undefined;
    const outbox: string[] = [];
    const encSend = (obj: unknown): void => {
      const text = JSON.stringify(obj);
      if (enc) void enc.send(text);
      else outbox.push(text);
    };
    const transport: Transport = {
      onmessage: null,
      onclose: null,
      onerror: null,
      send: (data) => this.ws?.send(JSON.stringify({ t: "msg", ch, data: typeof data === "string" ? data : "" })),
      close: () => this.ws?.send(JSON.stringify({ t: "close", ch })),
    };
    const handler = this.opts.onChannel(encSend);
    // createDaemonChannel installs transport.onmessage synchronously (handshake hello
    // handler), so feedRaw can route frames immediately.
    void createDaemonChannel(transport, crypto.daemonKeyPair, {
      onmessage: (pt) => handler.feed(typeof pt === "string" ? pt : ""),
    })
      .then((channel) => {
        enc = channel;
        for (const t of outbox) void enc.send(t);
        outbox.length = 0;
      })
      .catch(() => {
        /* handshake failed — channel stays silent until the client retries/reconnects */
      });
    return {
      feedRaw: (data) => transport.onmessage?.(data),
      dispose: () => {
        try {
          enc?.close();
        } catch {
          /* ignore */
        }
        handler.dispose();
      },
    };
  }

  close(): void {
    this.ws?.close();
    this.ws = undefined;
  }
}
