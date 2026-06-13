/**
 * Wire protocol — a minimal client-side mirror of @prism/daemon's protocol.
 * Append-only (add fields, never remove/narrow). Kept separate so a client never
 * carries a runtime dependency on the server package. Drift is caught by the
 * conformance test (the client connects to a real Broker and compares registries).
 */
export type ServiceId = string;
export type AdapterType = "websocket" | "rest" | "stdio-mcp" | "flask-http";
export type ServiceStatus = "stopped" | "starting" | "ready" | "error";

export interface SkillManifestEntry {
  name: string;
  description: string;
  methods: string[];
}

export interface ServiceDescriptor {
  id: ServiceId;
  name: string;
  status: ServiceStatus;
  /** Optional client-side: full descriptors arrive in `welcome`; a runtime
   *  service_update for a brand-new service carries only id/status/capabilities. */
  adapterType?: AdapterType;
  endpoint?: { local?: string; cloud?: string };
  capabilities: SkillManifestEntry[];
  healthProbe?: string;
}

export interface WSHello {
  type: "hello";
  clientId: string;
  version: string;
  caps?: string[];
}

export interface WSWelcome {
  type: "welcome";
  brokerVersion: string;
  sessionId: string;
  services: ServiceDescriptor[];
  capabilities: string[];
}

export interface BrokerEnvelope {
  type?: "request";
  id: string;
  service: ServiceId;
  method: string;
  payload?: unknown;
  caps?: string[];
  stream?: boolean;
  ts: number;
}

export interface BrokerResponse {
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: string; service?: ServiceId; message: string };
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

export type ServerMessage = WSWelcome | BrokerResponse | ServiceUpdate | ServiceStreamMessage;
