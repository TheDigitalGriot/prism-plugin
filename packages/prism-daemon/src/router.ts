/**
 * Router — resolves `envelope.service` to a registered service + its adapter and
 * dispatches the unary `call`. Streaming is handled by the broker (it owns the
 * client socket); the router exposes `adapterFor()` for that path.
 */
import type { BrokerEnvelope, BrokerResponse, ServiceId } from "./protocol";
import { errorResponse, okResponse } from "./protocol";
import type { Registry } from "./registry";
import type { Adapter } from "./adapters/types";

export class Router {
  private readonly adapters = new Map<ServiceId, Adapter>();

  constructor(private readonly registry: Registry) {}

  setAdapter(id: ServiceId, adapter: Adapter): void {
    this.adapters.set(id, adapter);
  }

  adapterFor(id: ServiceId): Adapter | undefined {
    return this.adapters.get(id);
  }

  async route(env: BrokerEnvelope): Promise<BrokerResponse> {
    const desc = this.registry.get(env.service);
    if (!desc) {
      return errorResponse(env.id, {
        code: "SERVICE_NOT_FOUND",
        service: env.service,
        message: `No service registered with id '${env.service}'`,
      });
    }
    const adapter = this.adapters.get(env.service);
    if (!adapter) {
      return errorResponse(env.id, {
        code: "SERVICE_UNAVAILABLE",
        service: env.service,
        message: `Service '${env.service}' is registered (status: ${desc.status}) but has no adapter wired`,
      });
    }
    try {
      const result = await adapter.call(env.method, env.payload);
      return okResponse(env.id, result);
    } catch (err) {
      return errorResponse(env.id, {
        code: "ADAPTER_ERROR",
        service: env.service,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async disconnectAll(): Promise<void> {
    await Promise.all([...this.adapters.values()].map((a) => a.disconnect().catch(() => undefined)));
    this.adapters.clear();
  }
}
