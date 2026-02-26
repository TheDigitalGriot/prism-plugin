/**
 * IPC message types for gRPC-over-postMessage protocol.
 * Bidirectional: webview ↔ extension host.
 */

// --- Webview → Extension ---

export interface GrpcRequest {
  service: string
  method: string
  message: unknown
  request_id: string
  is_streaming: boolean
}

export interface GrpcRequestCancel {
  request_id: string
}

export type WebviewToExtMessage =
  | { type: "grpc_request"; grpc_request: GrpcRequest }
  | { type: "grpc_request_cancel"; grpc_request_cancel: GrpcRequestCancel }

// --- Extension → Webview ---

export interface GrpcResponse {
  message?: unknown
  request_id: string
  error?: string
  /** true = more chunks coming, false = stream complete */
  is_streaming: boolean
}

export type ExtToWebviewMessage =
  | { type: "grpc_response"; grpc_response: GrpcResponse }
  | { type: "command"; command: string; payload?: unknown }
