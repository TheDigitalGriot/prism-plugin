import React, { useEffect, useRef, useState } from "react"

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

interface AgentDef {
  name: string
  color: string
  status: "thinking" | "idle"
  x: number
}

const AGENTS: AgentDef[] = [
  { name: "Claude", color: "#14b8a6", status: "thinking", x: 100 },
  { name: "Researcher", color: "#3b82f6", status: "idle", x: 240 },
  { name: "Validator", color: "#f59e0b", status: "idle", x: 380 },
]

// ---------------------------------------------------------------------------
// PixelAgent — animated agent at a desk
// ---------------------------------------------------------------------------

interface PixelAgentProps {
  agent: AgentDef
  frame: number
}

const PixelAgent: React.FC<PixelAgentProps> = ({ agent, frame }) => {
  const isThinking = agent.status === "thinking"

  // Bob amount: oscillates ±2px when thinking, else 0
  const bobY = isThinking ? Math.sin(frame * 0.15) * 2 : 0

  // Thinking dots: cycle 0 → 3
  const dotCount = Math.floor(frame / 4) % 4

  // Monitor screen glow
  const monitorGlow = isThinking
    ? `0 0 6px 2px rgba(20,184,166,0.6)`
    : `0 0 2px 0 rgba(20,184,166,0.15)`

  const floorY = 90 // floor line (within container)
  const deskH = 12
  const deskY = floorY - deskH
  const bodyH = 18
  const bodyW = 16
  const bodyY = deskY - bodyH - 2
  const headSize = 12
  const headY = bodyY - headSize - 2 + bobY

  return (
    <div style={{ position: "absolute", left: agent.x, top: 0, bottom: 0 }}>
      {/* Head */}
      <div
        style={{
          position: "absolute",
          left: 2,
          top: headY,
          width: headSize,
          height: headSize,
          backgroundColor: "#e8c89a",
          borderRadius: 2,
          border: "1px solid #c8a870",
        }}
      />

      {/* Body */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: bodyY,
          width: bodyW,
          height: bodyH,
          backgroundColor: agent.color,
          borderRadius: "2px 2px 0 0",
          opacity: 0.9,
        }}
      />

      {/* Desk surface */}
      <div
        style={{
          position: "absolute",
          left: -6,
          top: deskY,
          width: bodyW + 12,
          height: deskH,
          backgroundColor: "#4b5563",
          borderRadius: "2px 2px 0 0",
          border: "1px solid #6b7280",
        }}
      />

      {/* Desk legs */}
      {[0, bodyW + 2].map((lx) => (
        <div
          key={lx}
          style={{
            position: "absolute",
            left: lx - 6,
            top: deskY + deskH,
            width: 3,
            height: floorY - deskY - deskH,
            backgroundColor: "#374151",
          }}
        />
      ))}

      {/* Monitor */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: deskY - 20,
          width: 18,
          height: 14,
          backgroundColor: "#1f2937",
          border: "1px solid #4b5563",
          borderRadius: 2,
          boxShadow: monitorGlow,
          transition: "box-shadow 0.4s ease",
          overflow: "hidden",
        }}
      >
        {/* Screen */}
        <div
          style={{
            margin: 2,
            height: "calc(100% - 4px)",
            backgroundColor: isThinking ? "rgba(20,184,166,0.35)" : "rgba(20,184,166,0.08)",
            borderRadius: 1,
            transition: "background-color 0.4s ease",
          }}
        />
      </div>

      {/* Monitor stand */}
      <div
        style={{
          position: "absolute",
          left: 7,
          top: deskY - 6,
          width: 3,
          height: 6,
          backgroundColor: "#4b5563",
        }}
      />

      {/* Name + status label */}
      <div
        style={{
          position: "absolute",
          top: floorY + 4,
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
          fontSize: 9,
          color: "var(--prism-fg-muted)",
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        <div style={{ color: agent.color, fontWeight: 600 }}>{agent.name}</div>
        {isThinking && (
          <div style={{ color: "var(--prism-fg-disabled)", letterSpacing: 1 }}>
            {".".repeat(dotCount)}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PixelOffice — full CSS pixel art office scene
// ---------------------------------------------------------------------------

export const PixelOffice: React.FC = () => {
  const [frame, setFrame] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setFrame((f) => f + 1)
    }, 400)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--prism-bg-editor)",
      }}
    >
      {/* Wall (top 10px strip) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 10,
          backgroundColor: "var(--prism-bg-rail)",
          borderBottom: "1px solid var(--prism-border)",
        }}
      />

      {/* Wall decorations (frames) */}
      {[60, 200, 340, 480].map((lx) => (
        <div
          key={lx}
          style={{
            position: "absolute",
            left: lx,
            top: 14,
            width: 20,
            height: 16,
            border: "1px solid var(--prism-border)",
            borderRadius: 1,
            backgroundColor: "var(--prism-bg-surface)",
          }}
        />
      ))}

      {/* Floor (bottom 30px) — alternating tile pattern */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 30,
          background:
            "repeating-linear-gradient(90deg, var(--prism-bg-surface) 0px, var(--prism-bg-surface) 24px, var(--prism-bg-rail) 24px, var(--prism-bg-rail) 48px)",
          borderTop: "1px solid var(--prism-border)",
        }}
      />

      {/* Plant (far left) */}
      <div style={{ position: "absolute", left: 18, bottom: 30 }}>
        {/* Pot */}
        <div
          style={{
            width: 14,
            height: 10,
            backgroundColor: "#92400e",
            borderRadius: "0 0 3px 3px",
            border: "1px solid #78350f",
          }}
        />
        {/* Leaves */}
        <div
          style={{
            position: "absolute",
            top: -14,
            left: 2,
            width: 10,
            height: 16,
            backgroundColor: "#16a34a",
            borderRadius: "50% 50% 10% 10%",
            border: "1px solid #15803d",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -10,
            left: -3,
            width: 8,
            height: 12,
            backgroundColor: "#22c55e",
            borderRadius: "50% 30% 10% 30%",
            border: "1px solid #16a34a",
          }}
        />
      </div>

      {/* Water cooler (far right area) */}
      <div style={{ position: "absolute", right: 30, bottom: 30 }}>
        {/* Bottle (blue) */}
        <div
          style={{
            width: 14,
            height: 22,
            backgroundColor: "#60a5fa",
            borderRadius: "3px 3px 0 0",
            border: "1px solid #3b82f6",
            opacity: 0.8,
          }}
        />
        {/* Base (gray) */}
        <div
          style={{
            width: 18,
            height: 10,
            backgroundColor: "#4b5563",
            borderRadius: "0 0 2px 2px",
            marginLeft: -2,
            border: "1px solid #6b7280",
          }}
        />
        {/* Tap */}
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: 3,
            width: 4,
            height: 4,
            backgroundColor: "#9ca3af",
            borderRadius: 1,
          }}
        />
      </div>

      {/* Agents */}
      {AGENTS.map((agent) => (
        <PixelAgent key={agent.name} agent={agent} frame={frame} />
      ))}
    </div>
  )
}
