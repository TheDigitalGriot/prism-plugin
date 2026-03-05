import { useEffect, useState } from "react";

type Platform = "windows" | "macos" | "unknown";

function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("unknown");

  useEffect(() => {
    import("@tauri-apps/plugin-os").then(({ platform: getPlatform }) => {
      const os = getPlatform();
      if (os === "windows") setPlatform("windows");
      else if (os === "macos") setPlatform("macos");
      else setPlatform("unknown");
    });
  }, []);

  return platform;
}

export default function App() {
  const platform = usePlatform();

  return (
    <div className="h-screen w-screen bg-[#0F172A] text-[#F1F5F9] flex items-center justify-center select-none">
      <div className="text-center">
        <h1
          className="text-3xl font-bold mb-2"
          style={{
            background: "linear-gradient(90deg, #4A9EFF, #2DD4BF, #4ADE80)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          PRISM
        </h1>
        <p className="text-sm text-[#64748B]">
          {platform === "unknown"
            ? "Detecting platform..."
            : `Installer loading for ${platform}...`}
        </p>
      </div>
    </div>
  );
}
