/**
 * gRPC-over-postMessage handler.
 *
 * Maintains a global registry of service handlers. Handlers are registered
 * by the controller during initialization (binding `this` to close over state).
 *
 * Only two message types flow over the IPC bridge:
 *   grpc_request  — webview → extension
 *   grpc_response — extension → webview
 */

export type StreamResponseFn = (message: unknown, isLast?: boolean) => Promise<void>

type UnaryHandlerFn = (message: unknown) => Promise<unknown>
type StreamHandlerFn = (
  message: unknown,
  respond: StreamResponseFn,
  requestId: string,
) => Promise<void>

const _unaryRegistry = new Map<string, UnaryHandlerFn>()
const _streamRegistry = new Map<string, StreamHandlerFn>()

/**
 * Seam bridge — a forwarder for `service.method` keys with no local handler.
 * The host (Electron main / VS Code extension) injects one that reaches the
 * daemon broker, so the renderer's existing gRPC client transparently calls
 * brokered services (code-intel, design-gen, …) over the same envelope.
 *
 * Returns true when it handled the request (sent its own response via `respond`),
 * false to decline (fall through to the local "unknown handler" path).
 */
export type BrokerForwarder = (
  request: { service: string; method: string; message: unknown; request_id: string; is_streaming: boolean },
  respond: StreamResponseFn,
) => Promise<boolean>

let _brokerForwarder: BrokerForwarder | null = null

/** Install (or clear, with null) the broker forwarder used for unhandled keys. */
export function registerBrokerForwarder(fn: BrokerForwarder | null): void {
  _brokerForwarder = fn
}

/** Register a unary (request-response) handler. */
export function registerUnary(service: string, method: string, fn: UnaryHandlerFn): void {
  _unaryRegistry.set(`${service}.${method}`, fn)
}

/** Register a streaming (server-push) handler. */
export function registerStream(service: string, method: string, fn: StreamHandlerFn): void {
  _streamRegistry.set(`${service}.${method}`, fn)
}

/** Remove all handlers (useful for test cleanup). Does not touch the broker forwarder. */
export function clearHandlers(): void {
  _unaryRegistry.clear()
  _streamRegistry.clear()
}

/**
 * Dispatch an incoming gRPC request from the webview.
 * @param postMessage  Function that sends a message back to the webview.
 * @param request      The grpc_request payload.
 */
export async function handleGrpcRequest(
  postMessage: (msg: unknown) => Promise<void>,
  request: {
    service: string
    method: string
    message: unknown
    request_id: string
    is_streaming: boolean
  },
): Promise<void> {
  const { service, method, message, request_id, is_streaming } = request
  const key = `${service}.${method}`

  /** Send a gRPC response chunk back to the webview. */
  const respond: StreamResponseFn = async (msg: unknown, isLast = false) => {
    await postMessage({
      type: "grpc_response",
      grpc_response: {
        message: msg,
        request_id,
        is_streaming: !isLast,
      },
    })
  }

  // Seam bridge: keys with no local handler may belong to a brokered service.
  const hasLocal = is_streaming ? _streamRegistry.has(key) : _unaryRegistry.has(key)
  if (!hasLocal && _brokerForwarder) {
    try {
      const handled = await _brokerForwarder({ service, method, message, request_id, is_streaming }, respond)
      if (handled) return
    } catch (err) {
      console.error(`[Prism] broker forwarder error for ${key}:`, err)
      await postMessage({
        type: "grpc_response",
        grpc_response: { error: `broker forward failed: ${String(err)}`, request_id, is_streaming: false },
      })
      return
    }
  }

  if (is_streaming) {
    const handler = _streamRegistry.get(key)
    if (!handler) {
      console.error(`[Prism] No streaming handler for: ${key}`)
      await respond({ error: `Unknown streaming handler: ${key}` }, true)
      return
    }
    try {
      await handler(message, respond, request_id)
    } catch (err) {
      console.error(`[Prism] Error in streaming handler ${key}:`, err)
      await respond({ error: String(err) }, true)
    }
  } else {
    const handler = _unaryRegistry.get(key)
    if (!handler) {
      console.error(`[Prism] No unary handler for: ${key}`)
      await postMessage({
        type: "grpc_response",
        grpc_response: {
          error: `Unknown handler: ${key}`,
          request_id,
          is_streaming: false,
        },
      })
      return
    }
    try {
      const result = await handler(message)
      await postMessage({
        type: "grpc_response",
        grpc_response: {
          message: result,
          request_id,
          is_streaming: false,
        },
      })
    } catch (err) {
      console.error(`[Prism] Error in unary handler ${key}:`, err)
      await postMessage({
        type: "grpc_response",
        grpc_response: {
          error: String(err),
          request_id,
          is_streaming: false,
        },
      })
    }
  }
}
