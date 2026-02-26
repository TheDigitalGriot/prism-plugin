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

/** Register a unary (request-response) handler. */
export function registerUnary(service: string, method: string, fn: UnaryHandlerFn): void {
  _unaryRegistry.set(`${service}.${method}`, fn)
}

/** Register a streaming (server-push) handler. */
export function registerStream(service: string, method: string, fn: StreamHandlerFn): void {
  _streamRegistry.set(`${service}.${method}`, fn)
}

/** Remove all handlers (useful for test cleanup). */
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
