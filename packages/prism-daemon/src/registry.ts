/**
 * Service registry — the broker's in-memory map of brokered services.
 * Pushed to clients on WSWelcome and on every service_update.
 */
import type { ServiceDescriptor, ServiceId, ServiceStatus, SkillManifestEntry } from "./protocol";

export class Registry {
  private readonly services = new Map<ServiceId, ServiceDescriptor>();

  upsert(desc: ServiceDescriptor): void {
    this.services.set(desc.id, desc);
  }

  get(id: ServiceId): ServiceDescriptor | undefined {
    return this.services.get(id);
  }

  has(id: ServiceId): boolean {
    return this.services.has(id);
  }

  remove(id: ServiceId): boolean {
    return this.services.delete(id);
  }

  /** A defensive copy of all descriptors — safe to ship over the wire. */
  snapshot(): ServiceDescriptor[] {
    return [...this.services.values()].map((d) => ({ ...d }));
  }

  setStatus(id: ServiceId, status: ServiceStatus, capabilities?: SkillManifestEntry[]): ServiceDescriptor | undefined {
    const desc = this.services.get(id);
    if (!desc) return undefined;
    desc.status = status;
    if (capabilities) desc.capabilities = capabilities;
    return desc;
  }
}
