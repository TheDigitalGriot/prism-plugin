/**
 * runtime-paths — pure resolution of where the bundled broker + its sidecar
 * files live, in dev vs packaged builds. No `electron` import, so it unit-tests
 * directly.
 *
 * Layout (produced by scripts/build-daemon.mjs, shipped via forge extraResource):
 *   <daemon-dist>/prism-daemon.cjs        the esbuilt broker
 *   <daemon-dist>/services.config.json    service registry config
 *   <daemon-dist>/meta.json               { version } — version-sync oracle
 *
 * dev:      <appRoot>/daemon-dist          (appRoot = app.getAppPath())
 * packaged: <resourcesPath>/daemon-dist    (extraResource './daemon-dist')
 */
import { join } from "node:path";
import { readFileSync } from "node:fs";

export interface RuntimeLocation {
  isPackaged: boolean;
  resourcesPath: string;
  appRoot: string;
}

export function resolveDaemonDist(loc: RuntimeLocation): string {
  return loc.isPackaged ? join(loc.resourcesPath, "daemon-dist") : join(loc.appRoot, "daemon-dist");
}

export function resolveBrokerEntry(daemonDist: string): string {
  return join(daemonDist, "prism-daemon.cjs");
}

export function resolveConfigPath(daemonDist: string): string {
  return join(daemonDist, "services.config.json");
}

/** Read the expected broker version from meta.json; "unknown" if missing/unreadable. */
export function readExpectedVersion(
  daemonDist: string,
  read: (p: string, enc: "utf-8") => string = readFileSync,
): string {
  try {
    const meta = JSON.parse(read(join(daemonDist, "meta.json"), "utf-8")) as { version?: string };
    return typeof meta.version === "string" ? meta.version : "unknown";
  } catch {
    return "unknown";
  }
}
