/**
 * Entry point. Loads the static service registry from services.config.json and
 * boots the broker. Backends/adapters are wired in Phase 2+; in Phase 1 the
 * registry is populated (status: stopped) but no transport is attached.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Broker } from "./broker";
import { Registry } from "./registry";
import type { ServiceDescriptor } from "./protocol";

// Public surface of the daemon package (used by tooling, tests, and conformance checks).
export { Broker, BROKER_VERSION } from "./broker";
export { Registry } from "./registry";
export * from "./protocol";

const HOST = process.env.PRISM_DAEMON_HOST ?? "127.0.0.1";
const PORT = Number(process.env.PRISM_DAEMON_PORT ?? 6780);
const CONFIG_PATH = join(__dirname, "..", "services.config.json");

/** Normalize a partial config entry into a full descriptor (status defaults to "stopped"). */
function normalize(entry: Partial<ServiceDescriptor> & { id: string; adapterType: ServiceDescriptor["adapterType"] }): ServiceDescriptor {
  return {
    id: entry.id,
    name: entry.name ?? entry.id,
    status: entry.status ?? "stopped",
    adapterType: entry.adapterType,
    endpoint: entry.endpoint ?? {},
    capabilities: entry.capabilities ?? [],
    healthProbe: entry.healthProbe ?? "",
    gate: entry.gate,
    spawnCmd: entry.spawnCmd,
    lastProbe: entry.lastProbe,
  };
}

export function loadConfig(path: string = CONFIG_PATH): ServiceDescriptor[] {
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as Array<
      Partial<ServiceDescriptor> & { id: string; adapterType: ServiceDescriptor["adapterType"] }
    >;
    return raw.map(normalize);
  } catch (err) {
    console.error(`[prism-daemon] failed to read ${path}:`, err);
    return [];
  }
}

async function main(): Promise<void> {
  const registry = new Registry();
  for (const desc of loadConfig()) registry.upsert(desc);

  const broker = new Broker({ registry });
  const port = await broker.listen(HOST, PORT);
  console.log(
    `[prism-daemon] broker listening on ws://${HOST}:${port} — ${registry.snapshot().length} service(s) in registry`,
  );

  await broker.init();
  const ready = registry.snapshot().filter((s) => s.status === "ready").map((s) => s.id);
  console.log(`[prism-daemon] ready services: ${ready.length > 0 ? ready.join(", ") : "(none reachable yet)"}`);

  broker.startHealthLoop();
  console.log(`[prism-daemon] control plane: POST /register · POST /deregister · GET /services`);

  const shutdown = () => {
    void broker.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Only auto-start when run directly (so tests can import without binding a port).
if (require.main === module) {
  void main();
}
