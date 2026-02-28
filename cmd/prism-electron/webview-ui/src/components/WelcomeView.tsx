import React, { useState } from "react"
import { UiServiceClient } from "../services/grpc-client"

// ---------------------------------------------------------------------------
// WelcomeView — shown to first-time users who have no .prism/ directory
// ---------------------------------------------------------------------------

interface WelcomeStep {
  icon: string
  title: string
  description: string
  phase?: string
  color?: string
}

const STEPS: WelcomeStep[] = [
  {
    icon: "◎",
    title: "Research",
    description: "Spawn parallel AI agents to map your codebase — architecture, patterns, dependencies.",
    phase: "research",
    color: "#3b82f6",
  },
  {
    icon: "◈",
    title: "Plan",
    description: "Interactively design an implementation strategy with success criteria before writing any code.",
    phase: "plan",
    color: "#14b8a6",
  },
  {
    icon: "◆",
    title: "Implement",
    description: "Execute the approved plan phase by phase with verification at each checkpoint.",
    phase: "implement",
    color: "#22c55e",
  },
  {
    icon: "◉",
    title: "Validate",
    description: "Verify every success criterion — automated tests and manual checks — before shipping.",
    phase: "validate",
    color: "#f59e0b",
  },
]

// ---------------------------------------------------------------------------
// Prism logo — inline SVG with spectral gradient
// ---------------------------------------------------------------------------

const PrismLogo: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="48"
    height="48"
    fill="none"
  >
    <defs>
      <linearGradient id="welcome-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="33%" stopColor="#14b8a6" />
        <stop offset="66%" stopColor="#22c55e" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    {/* Prism triangle */}
    <polygon
      points="24,4 4,40 44,40"
      stroke="url(#welcome-logo-grad)"
      strokeWidth="2.5"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Refraction line */}
    <line x1="24" y1="4" x2="24" y2="40" stroke="url(#welcome-logo-grad)" strokeWidth="1.5" strokeOpacity="0.5" />
    {/* Dispersion rays */}
    <line x1="24" y1="22" x2="38" y2="30" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.7" />
    <line x1="24" y1="22" x2="34" y2="28" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.8" />
    <line x1="24" y1="22" x2="30" y2="26" stroke="#14b8a6" strokeWidth="1.5" strokeOpacity="0.9" />
  </svg>
)

// ---------------------------------------------------------------------------
// WelcomeView
// ---------------------------------------------------------------------------

interface WelcomeViewProps {
  onInitPrism?: () => void
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onInitPrism }) => {
  const [initError, setInitError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)

  const handleOpenProject = async () => {
    setIsOpening(true)
    try {
      await window.electronAPI?.invoke("prism:openProject")
    } catch (err) {
      console.error("[Prism] openProject failed:", err)
    } finally {
      setIsOpening(false)
    }
  }

  const handleInitPrism = async () => {
    setInitError(null)
    try {
      const result = await UiServiceClient.initPrism()
      if (!result.ok) {
        setInitError("Open a project folder first (File \u2192 Open Project\u2026)")
      } else {
        onInitPrism?.()
      }
    } catch (err) {
      console.error("[Prism] initPrism failed:", err)
      setInitError(String(err))
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px",
        gap: "20px",
        overflowY: "auto",
        height: "100%",
      }}
    >
      {/* Logo + title */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          marginTop: "12px",
        }}
      >
        <PrismLogo />
        <div
          style={{
            fontSize: "18px",
            fontWeight: 700,
            background: "linear-gradient(90deg, #3b82f6, #14b8a6, #22c55e, #f59e0b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Prism
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--prism-fg-muted)",
            textAlign: "center",
            maxWidth: "260px",
          }}
        >
          AI-powered structured development workflow for Claude Code
        </div>
      </div>

      {/* 4-phase steps */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
          maxWidth: "300px",
        }}
      >
        {STEPS.map((step) => (
          <div
            key={step.phase}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "6px",
              backgroundColor: `${step.color}11`,
              border: `1px solid ${step.color}33`,
            }}
          >
            <span style={{ color: step.color, fontSize: "16px", lineHeight: 1.4, flexShrink: 0 }}>
              {step.icon}
            </span>
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: step.color,
                  marginBottom: "3px",
                }}
              >
                {step.title}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--prism-fg-muted)",
                  lineHeight: 1.5,
                }}
              >
                {step.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          width: "100%",
          maxWidth: "300px",
        }}
      >
        {/* Primary: Open Project */}
        <button
          onClick={() => void handleOpenProject()}
          disabled={isOpening}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: "6px",
            border: "none",
            background: "linear-gradient(90deg, #3b82f6, #14b8a6)",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: isOpening ? "not-allowed" : "pointer",
            opacity: isOpening ? 0.7 : 1,
          }}
        >
          {isOpening ? "Opening\u2026" : "Open Project\u2026"}
        </button>
        <div
          style={{
            fontSize: "11px",
            color: "var(--prism-fg-muted)",
            textAlign: "center",
          }}
        >
          Select a project folder to get started
        </div>

        {/* Secondary: Initialize .prism/ */}
        <button
          onClick={() => void handleInitPrism()}
          style={{
            width: "100%",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid var(--prism-border)",
            background: "transparent",
            color: "var(--prism-fg-muted)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Initialize .prism/ Directory
        </button>
        {initError && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--prism-error)",
              textAlign: "center",
              padding: "4px 8px",
              borderRadius: "4px",
              backgroundColor: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              width: "100%",
            }}
          >
            {initError}
          </div>
        )}
        <div
          style={{
            fontSize: "11px",
            color: "var(--prism-fg-muted)",
            textAlign: "center",
          }}
        >
          Creates the .prism/ folder structure in your project folder
        </div>
      </div>

      {/* Tip */}
      <div
        style={{
          fontSize: "11px",
          color: "var(--prism-fg-muted)",
          textAlign: "center",
          maxWidth: "280px",
          padding: "8px 12px",
          borderRadius: "4px",
          backgroundColor: "var(--prism-bg-hover)",
          border: "1px solid var(--prism-border)",
        }}
      >
        Already have a{" "}
        <code style={{ fontFamily: "var(--prism-font-mono)", fontSize: "10px" }}>.prism/</code>{" "}
        directory? It will be detected automatically when you open the project.
      </div>

      {/* Keyboard hint */}
      <div
        style={{
          fontSize: "10px",
          color: "var(--prism-fg-disabled)",
          textAlign: "center",
        }}
      >
        File \u2192 Open Project\u2026 (Ctrl+O) to open a project at any time
      </div>
    </div>
  )
}
