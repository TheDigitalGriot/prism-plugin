/**
 * Adapter contract — one implementation per protocol family. An adapter is bound
 * to a single ServiceDescriptor and translates the backend's native protocol to
 * the broker's uniform call/stream interface.
 *
 * Spec: .prism/shared/designs/2026-06-12-daemon-broker-design.md (§5)
 */
import type { AdapterType, ServiceDescriptor, SkillManifestEntry } from "../protocol";

export interface ProbeResult {
  ok: boolean;
  via: "local" | "cloud";
  latencyMs: number;
  manifest?: SkillManifestEntry[];
}

export interface StreamEvent {
  seq: number;
  kind: string;
  data: unknown;
}

export interface Adapter {
  readonly type: AdapterType;
  /** Open the transport (idempotent). */
  connect(): Promise<void>;
  /** Readiness via the backend's discovery endpoint. Never throws — returns ok:false instead. */
  probe(): Promise<ProbeResult>;
  /** Capabilities sourced from the backend's SKILL.md / discovery manifest. */
  describe(): Promise<SkillManifestEntry[]>;
  /** Unary request → result. Throws on backend error. */
  call(method: string, payload: unknown): Promise<unknown>;
  /** Streaming request → async sequence of events. */
  stream(method: string, payload: unknown): AsyncIterable<StreamEvent>;
  disconnect(): Promise<void>;
}

export type AdapterFactory = (desc: ServiceDescriptor) => Adapter;
