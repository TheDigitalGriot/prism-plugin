/**
 * ProtoBusClient — base class for gRPC-over-postMessage clients.
 *
 * Adapted from Cline's grpc-client-base.ts pattern.
 *
 * Two request modes:
 *   unary    — single request, single response
 *   streaming — single request, multiple responses until is_streaming === false
 *
 * Message correlation is done via request_id (UUID v4).
 */
import { v4 as uuidv4 } from "uuid"
import { vscodeApi } from "../vscode"

export interface StreamCallbacks<T> {
  onResponse: (response: T) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

export abstract class ProtoBusClient {
  /** Make a unary (request → response) call. */
  protected static makeUnaryRequest<TRequest, TResponse>(
    service: string,
    method: string,
    message: TRequest,
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4()

      const handler = (event: MessageEvent) => {
        const msg = event.data as {
          type: string
          grpc_response?: {
            request_id: string
            message?: TResponse
            error?: string
            is_streaming: boolean
          }
        }

        if (msg?.type !== "grpc_response") return
        if (msg.grpc_response?.request_id !== requestId) return

        window.removeEventListener("message", handler)

        if (msg.grpc_response.error) {
          reject(new Error(msg.grpc_response.error))
        } else {
          resolve(msg.grpc_response.message as TResponse)
        }
      }

      window.addEventListener("message", handler)

      vscodeApi.postMessage({
        type: "grpc_request",
        grpc_request: {
          service,
          method,
          message,
          request_id: requestId,
          is_streaming: false,
        },
      })
    })
  }

  /**
   * Make a streaming call.
   * @returns unsubscribe function — call to cancel the subscription
   */
  protected static makeStreamingRequest<TRequest, TResponse>(
    service: string,
    method: string,
    message: TRequest,
    callbacks: StreamCallbacks<TResponse>,
  ): () => void {
    const requestId = uuidv4()

    const handler = (event: MessageEvent) => {
      const msg = event.data as {
        type: string
        grpc_response?: {
          request_id: string
          message?: TResponse
          error?: string
          is_streaming: boolean
        }
      }

      if (msg?.type !== "grpc_response") return
      if (msg.grpc_response?.request_id !== requestId) return

      const response = msg.grpc_response

      if (response.error) {
        callbacks.onError?.(new Error(response.error))
        window.removeEventListener("message", handler)
        return
      }

      if (response.message !== undefined) {
        callbacks.onResponse(response.message as TResponse)
      }

      // Stream is done when is_streaming === false
      if (response.is_streaming === false) {
        callbacks.onComplete?.()
        window.removeEventListener("message", handler)
      }
    }

    window.addEventListener("message", handler)

    vscodeApi.postMessage({
      type: "grpc_request",
      grpc_request: {
        service,
        method,
        message,
        request_id: requestId,
        is_streaming: true,
      },
    })

    // Return unsubscribe function
    return () => {
      window.removeEventListener("message", handler)
      vscodeApi.postMessage({
        type: "grpc_request_cancel",
        grpc_request_cancel: { request_id: requestId },
      })
    }
  }
}
