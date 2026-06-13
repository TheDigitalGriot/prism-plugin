import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  resolveDaemonDist,
  resolveBrokerEntry,
  resolveConfigPath,
  readExpectedVersion,
} from "./runtime-paths";

describe("runtime-paths", () => {
  it("resolves daemon-dist under appRoot in dev", () => {
    const d = resolveDaemonDist({ isPackaged: false, resourcesPath: "/res", appRoot: "/app" });
    expect(d).toBe(join("/app", "daemon-dist"));
  });

  it("resolves daemon-dist under resourcesPath when packaged", () => {
    const d = resolveDaemonDist({ isPackaged: true, resourcesPath: "/res", appRoot: "/app" });
    expect(d).toBe(join("/res", "daemon-dist"));
  });

  it("resolves broker entry + config siblings", () => {
    const d = join("/x", "daemon-dist");
    expect(resolveBrokerEntry(d)).toBe(join(d, "prism-daemon.cjs"));
    expect(resolveConfigPath(d)).toBe(join(d, "services.config.json"));
  });

  it("reads expected version from meta.json", () => {
    const d = join("/x", "daemon-dist");
    const v = readExpectedVersion(d, (p) => {
      expect(p).toBe(join(d, "meta.json"));
      return JSON.stringify({ version: "1.2.3" });
    });
    expect(v).toBe("1.2.3");
  });

  it('returns "unknown" when meta is unreadable', () => {
    const v = readExpectedVersion("/x", () => {
      throw new Error("nope");
    });
    expect(v).toBe("unknown");
  });
});
