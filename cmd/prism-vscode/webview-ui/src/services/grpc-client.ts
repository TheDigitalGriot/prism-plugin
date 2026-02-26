/**
 * Prism gRPC service clients.
 *
 * One class per service, each method maps to a handler registered
 * in PrismController._registerHandlers().
 */
import { ProtoBusClient, StreamCallbacks } from "./grpc-client-base"

// ---------------------------------------------------------------------------
// StateService
// ---------------------------------------------------------------------------

export interface GetStateResponse {
  stateJson: string
}

export class StateServiceClient extends ProtoBusClient {
  /** Subscribe to state updates. Returns unsubscribe function. */
  static subscribeToState(callbacks: StreamCallbacks<GetStateResponse>): () => void {
    return this.makeStreamingRequest("StateService", "subscribeToState", {}, callbacks)
  }

  /** Get current state once (unary). */
  static getState(): Promise<GetStateResponse> {
    return this.makeUnaryRequest("StateService", "getState", {})
  }
}

// ---------------------------------------------------------------------------
// UiService
// ---------------------------------------------------------------------------

export interface InitializeWebviewResponse {
  ok: boolean
}

export class UiServiceClient extends ProtoBusClient {
  /** Called by webview on mount to trigger workspace detection and state push. */
  static initializeWebview(): Promise<InitializeWebviewResponse> {
    return this.makeUnaryRequest("UiService", "initializeWebview", {})
  }
}
