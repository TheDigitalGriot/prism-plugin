import React from "react"
import { useLayout } from "../../context/LayoutContext"

// ---------------------------------------------------------------------------
// Chat bubble SVG icon
// ---------------------------------------------------------------------------

const ChatIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
)

/**
 * FloatingChatPill — return-to-chat pill visible when not on Chat tab.
 * Gradient background with blur, pulsing glow, shifts up when bottom panel open.
 */
export const FloatingChatPill: React.FC = () => {
  const { activeTabId, setActiveTab, bottomOpen } = useLayout()

  if (activeTabId === "chat") return null

  return (
    <button
      onClick={() => setActiveTab("chat")}
      className="prism-chat-pill-glow"
      style={{
        position: "absolute",
        bottom: bottomOpen ? 196 : 16,
        right: 16,
        zIndex: 20,
        padding: "8px 16px 8px 12px",
        borderRadius: 20,
        border: "1px solid rgba(59,130,246,0.3)",
        background: "linear-gradient(135deg, rgba(59,130,246,0.8), rgba(20,184,166,0.8))",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: "#fff",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "bottom 0.2s ease",
      }}
    >
      <ChatIcon />
      Chat
      {/* Green status dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: "var(--prism-green)",
          flexShrink: 0,
        }}
      />
    </button>
  )
}
