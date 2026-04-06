import { usePlatform } from "./hooks/usePlatform";
import { WindowsInstaller } from "./screens/windows/index";
import { MacInstaller } from "./screens/macos/index";

export default function App() {
  const platform = usePlatform();

  if (platform === "windows") return <WindowsInstaller />;
  if (platform === "macos") return <MacInstaller />;

  // Loading state while detecting platform
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F172A",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -1,
            background:
              "linear-gradient(90deg, #4A9EFF, #2DD4BF, #4ADE80)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 8,
          }}
        >
          PRISM
        </div>
        <div style={{ color: "#64748B", fontSize: 12 }}>
          Detecting platform...
        </div>
      </div>
    </div>
  );
}
