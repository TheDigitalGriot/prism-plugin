import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleGrpcRequest,
  registerUnary,
  registerBrokerForwarder,
  clearHandlers,
  type BrokerForwarder,
} from "./grpc-handler"

interface GrpcResponseMsg {
  type: string
  grpc_response: { message?: unknown; error?: string; request_id: string; is_streaming: boolean }
}

afterEach(() => {
  clearHandlers()
  registerBrokerForwarder(null)
})

describe("grpc-handler seam bridge", () => {
  it("forwards an unhandled service.method to the broker forwarder", async () => {
    const sent: GrpcResponseMsg[] = []
    const post = async (m: unknown) => {
      sent.push(m as GrpcResponseMsg)
    }
    const forwarder: BrokerForwarder = vi.fn(async (req, respond) => {
      await respond({ echoed: req.message }, true)
      return true
    })
    registerBrokerForwarder(forwarder)

    await handleGrpcRequest(post, {
      service: "code-intel",
      method: "search",
      message: { q: 1 },
      request_id: "r1",
      is_streaming: false,
    })

    expect(forwarder).toHaveBeenCalledOnce()
    expect(sent[0]!.grpc_response.message).toEqual({ echoed: { q: 1 } })
    expect(sent[0]!.grpc_response.is_streaming).toBe(false)
  })

  it("prefers a local handler over the forwarder", async () => {
    registerUnary("StoriesService", "list", async () => ["a", "b"])
    const forwarder: BrokerForwarder = vi.fn(async () => true)
    registerBrokerForwarder(forwarder)

    const sent: GrpcResponseMsg[] = []
    await handleGrpcRequest(async (m) => void sent.push(m as GrpcResponseMsg), {
      service: "StoriesService",
      method: "list",
      message: {},
      request_id: "r2",
      is_streaming: false,
    })

    expect(forwarder).not.toHaveBeenCalled()
    expect(sent[0]!.grpc_response.message).toEqual(["a", "b"])
  })

  it("falls through to the unknown-handler error when the forwarder declines", async () => {
    registerBrokerForwarder(async () => false)
    const sent: GrpcResponseMsg[] = []
    await handleGrpcRequest(async (m) => void sent.push(m as GrpcResponseMsg), {
      service: "nope",
      method: "x",
      message: {},
      request_id: "r3",
      is_streaming: false,
    })

    expect(sent[0]!.grpc_response.error).toContain("Unknown handler")
  })

  it("reports a broker forward failure as a response error", async () => {
    registerBrokerForwarder(async () => {
      throw new Error("daemon unreachable")
    })
    const sent: GrpcResponseMsg[] = []
    await handleGrpcRequest(async (m) => void sent.push(m as GrpcResponseMsg), {
      service: "code-intel",
      method: "search",
      message: {},
      request_id: "r4",
      is_streaming: false,
    })

    expect(sent[0]!.grpc_response.error).toContain("broker forward failed")
  })
})
