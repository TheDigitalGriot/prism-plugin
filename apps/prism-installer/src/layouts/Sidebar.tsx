import { MAC } from "../theme/colors";

export interface SidebarStep {
  id: string;
  label: string;
}

interface SidebarProps {
  steps: SidebarStep[];
  currentStep: string;
}

export function Sidebar({ steps, currentStep }: SidebarProps) {
  const currentIdx = steps.findIndex((s) => s.id === currentStep);

  return (
    <div
      style={{
        width: 160,
        flexShrink: 0,
        background: MAC.sidebarBg,
        borderRight: `1px solid ${MAC.borderLight}`,
        padding: "20px 0",
      }}
    >
      {steps.map((s, i) => {
        const isDone = i < currentIdx;
        const isCurrent = s.id === currentStep;

        return (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 16px",
              marginBottom: 2,
              background: isCurrent ? "rgba(74,158,255,0.12)" : "transparent",
              borderLeft: isCurrent
                ? `2px solid ${MAC.blue}`
                : "2px solid transparent",
              transition: "all 0.2s",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                flexShrink: 0,
                background: isDone
                  ? MAC.green
                  : isCurrent
                  ? MAC.blue
                  : "rgba(255,255,255,0.08)",
                border: `1px solid ${
                  isDone
                    ? MAC.green
                    : isCurrent
                    ? MAC.blue
                    : "rgba(255,255,255,0.12)"
                }`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                color: isDone || isCurrent ? "white" : MAC.muted,
                fontWeight: 700,
                transition: "all 0.2s",
              }}
            >
              {isDone ? "✓" : i + 1}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: isCurrent ? 500 : 400,
                color: isDone ? MAC.light : isCurrent ? MAC.white : MAC.muted,
                transition: "all 0.2s",
              }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
