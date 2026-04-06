import { useEffect, useState } from "react";

export type Platform = "windows" | "macos" | "unknown";

let cached: Platform | null = null;

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>(cached ?? "unknown");

  useEffect(() => {
    if (cached) {
      setPlatform(cached);
      return;
    }
    import("@tauri-apps/plugin-os").then(({ platform: getPlatform }) => {
      const os = getPlatform();
      if (os === "windows") cached = "windows";
      else if (os === "macos") cached = "macos";
      else cached = "unknown";
      setPlatform(cached);
    });
  }, []);

  return platform;
}
