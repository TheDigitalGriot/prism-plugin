/**
 * Prism Daemon-Broker — wire + shared types (source of truth).
 *
 * Append-only schema. Add fields, never remove, never make optional -> required,
 * never narrow a type. New wire enum values are gated at serialization via
 * `Session.supports(cap)`. A 6-month-old client must still parse anything new.
 *
 * Spec: .prism/shared/designs/2026-06-12-daemon-broker-design.md (§3, §4)
 */

export type ServiceId = string;

export type AdapterType = "websocket" | "rest" | "stdio-mcp" | "flask-http";

export type ServiceStatus = "stopped" | "starting" | "ready" | "error";

export type BrokerErrorCode =
  | "SERVICE_NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "ADAPTER_ERROR"
  | "GATE_FAILED"
  | "METHOD_NOT_FOUND"
  | "PAYLOAD_INVALID"
  | "RELAY_ERROR"
  | "UNAUTHORIZED";

/** A capability/method entry sourced from a service's SKILL.md / discovery endpoint. */
export interface SkillManifestEntry {
  name: string;
  description: string;
  methods: string[];
}

/** Capability gate for try-local->cloud resolution (Phase 6 fills this in). */
export interface ServiceGate {
  kind: "vram" | "binary" | "custom";
  /** Minimum threshold (e.g. GB of VRAM) when `kind` is "vram". */
  min?: number;
}

export interface ServiceEndpoint {
  local?: string;
  cloud?: string;
}

export interface ProbeRecord {
  at: number;
  ok: boolean;
  latencyMs: number;
  via: "local" | "cloud";
}

/** The registry's record of one brokered service. */
export interface ServiceDescriptor {
  id: ServiceId;
  name: string;
  status: ServiceStatus;
  adapterType: AdapterType;
  endpoint: ServiceEndpoint;
  capabilities: SkillManifestEntry[];
  /** Discovery/readiness probe descriptor, e.g. "GET /api/skills" or "tools/list" or "hello". */
  healthProbe: string;
  gate?: ServiceGate;
  /** Optional command used to spawn the backend (stdio-mcp / flask-http). */
  spawnCmd?: string;
  lastProbe?: ProbeRecord;
}

// ── Client -> Broker ────────────────────────────────────────────────────────

export interface WSHello {
  type: "hello";
  clientId: string;
  version: string;
  caps?: string[];
}

/** A service call. `type` is optional so a bare `{ service, method }` is also accepted. */
export interface BrokerEnvelope {
  type?: "request";
  id: string;
  service: ServiceId;
  method: string;
  payload?: unknown;
  caps?: string[];
  /** When true, the broker dispatches to the adapter's streaming path and emits service_stream frames. */
  stream?: boolean;
  ts: number;
}

export interface PermissionResponse {
  type: "permission_response";
  id: string;
  decision: "allow" | "deny";
}

export type ClientMessage = WSHello | BrokerEnvelope | PermissionResponse;

// ── Broker -> Client ────────────────────────────────────────────────────────

export interface WSWelcome {
  type: "welcome";
  brokerVersion: string;
  sessionId: string;
  services: ServiceDescriptor[];
  capabilities: string[];
}

export interface BrokerError {
  code: BrokerErrorCode;
  service?: ServiceId;
  message: string;
  details?: unknown;
}

export interface BrokerResponse {
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: BrokerError;
}

export interface ServiceUpdate {
  type: "service_update";
  service: ServiceId;
  status: ServiceStatus;
  capabilities?: SkillManifestEntry[];
}

export interface ServiceStreamMessage {
  type: "service_stream";
  service: ServiceId;
  id: string;
  seq: number;
  event: unknown;
}

export interface PermissionRequest {
  type: "permission_request";
  service: ServiceId;
  id: string;
  prompt: string;
}

export type ServerMessage =
  | WSWelcome
  | BrokerResponse
  | ServiceUpdate
  | ServiceStreamMessage
  | PermissionRequest;

// ── Type guards ──────────────────────────────────────────────────────────────

export function isHello(msg: unknown): msg is WSHello {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "hello";
}

export function isEnvelope(msg: unknown): msg is BrokerEnvelope {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return typeof m.service === "string" && typeof m.method === "string" && typeof m.id === "string";
}

export function errorResponse(id: string, error: BrokerError): BrokerResponse {
  return { type: "response", id, ok: false, error };
}

export function okResponse(id: string, result: unknown): BrokerResponse {
  return { type: "response", id, ok: true, result };
}
