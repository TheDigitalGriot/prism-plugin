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
 * NOTE (follow-up, worklist §I): this bridge forwards frames in the clear. Production
 * hardening reuses paseo's E2EE zero-knowledge relay (ECDH + AES-256-GCM, QR pubkey
 * pairing), which first requires extracting apps/prism-mobile/packages/relay into a
 * shared workspace package (packages/prism-relay). The bridge seam here is unchanged
 * by that swap — only the transport under it gets encrypted.
 *
 * Spec: .prism/shared/designs/2026-06-12-daemon-broker-design.md (§7)
 */
import { WebSocket, type RawData } from "ws";

export interface ChannelHandler {
  feed: (text: string) => void;
  dispose: () => void;
}

export interface RelayOptions {
  url: string;
  /** Called when a remote channel opens; returns the per-channel session handler. */
  onChannel: (send: (obj: unknown) => void) => ChannelHandler;
}

export class RelayClient {
  private ws?: WebSocket;
  private readonly channels = new Map<string, ChannelHandler>();

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
      const send = (obj: unknown): void => {
        this.ws?.send(JSON.stringify({ t: "msg", ch, data: JSON.stringify(obj) }));
      };
      this.channels.set(ch, this.opts.onChannel(send));
    } else if (frame.t === "msg") {
      const data = typeof frame.data === "string" ? frame.data : JSON.stringify(frame.data);
      this.channels.get(ch)?.feed(data);
    } else if (frame.t === "close") {
      this.channels.get(ch)?.dispose();
      this.channels.delete(ch);
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = undefined;
  }
}
