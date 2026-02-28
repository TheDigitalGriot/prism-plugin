import React from "react"

/** 34px header bar — placeholder for Phase 1 */
export const HeaderBar: React.FC = () => {
  return (
    <div
      style={{
        height: 34,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: "var(--prism-bg-panel)",
        borderBottom: "1px solid var(--prism-border)",
        gap: 8,
      }}
    >
      {/* Spectral accent stripe */}
      <div
        style={{
          width: 3,
          height: 16,
          borderRadius: 2,
          background: "var(--prism-gradient)",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--prism-fg)",
          letterSpacing: "0.04em",
        }}
      >
        Prism
      </span>
      <div style={{ flex: 1 }} />
      {/* Phase buttons placeholder */}
      {(["R", "P", "I", "V"] as const).map((phase, i) => {
        const colors = [
          "var(--prism-blue)",
          "var(--prism-teal)",
          "var(--prism-green)",
          "var(--prism-amber)",
        ]
        return (
          <div
            key={phase}
            style={{
              width: 20,
              height: 20,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: colors[i],
              border: `1px solid ${colors[i]}44`,
            }}
          >
            {phase}
          </div>
        )
      })}
    </div>
  )
}
