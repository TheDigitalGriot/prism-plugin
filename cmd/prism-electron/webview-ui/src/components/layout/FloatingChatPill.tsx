import React from "react"
import { useLayout } from "../../context/LayoutContext"

/** Return-to-chat floating pill — placeholder for Phase 1 */
export const FloatingChatPill: React.FC = () => {
  const { activeTabId, setActiveTab } = useLayout()

  if (activeTabId === "chat") return null

  return (
    <button
      onClick={() => setActiveTab("chat")}
      className="prism-chat-pill-glow"
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        zIndex: 100,
        padding: "4px 12px",
        borderRadius: 9999,
        border: "1px solid rgba(59,130,246,0.4)",
        backgroundColor: "rgba(59,130,246,0.12)",
        color: "var(--prism-blue)",
        fontSize: 11,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      ◉ Chat
    </button>
  )
}
