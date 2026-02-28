import React from "react"
import { UiServiceClient } from "../services/grpc-client"

// ---------------------------------------------------------------------------
// WelcomeView — shown to first-time users who have no .prism/ directory
// and no API key configured.
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
  const handleInitPrism = async () => {
    try {
      await UiServiceClient.initPrism()
      onInitPrism?.()
    } catch (err) {
      console.error("[Prism] initPrism failed:", err)
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
            color: "var(--vscode-descriptionForeground)",
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
                  color: "var(--vscode-descriptionForeground)",
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
        <button
          onClick={() => void handleInitPrism()}
          style={{
            width: "100%",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: "linear-gradient(90deg, #3b82f6, #14b8a6)",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Initialize .prism/ Directory
        </button>
        <div
          style={{
            fontSize: "11px",
            color: "var(--vscode-descriptionForeground)",
            textAlign: "center",
          }}
        >
          Creates the .prism/ folder structure in your workspace root
        </div>
      </div>

      {/* Tip */}
      <div
        style={{
          fontSize: "11px",
          color: "var(--vscode-descriptionForeground)",
          textAlign: "center",
          maxWidth: "280px",
          padding: "8px 12px",
          borderRadius: "4px",
          backgroundColor: "var(--vscode-textBlockQuote-background, rgba(255,255,255,0.05))",
          border: "1px solid var(--vscode-widget-border, #333)",
        }}
      >
        💡 Already have a <code>.prism/</code> directory? It will be detected automatically when you open this workspace.
      </div>
    </div>
  )
}
