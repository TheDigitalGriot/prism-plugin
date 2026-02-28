/**
 * StoryList — compact list of stories with animated status icons.
 */
import React from "react"
import type { PrismStory } from "../../context/PrismStateContext"

interface StoryListProps {
  stories: PrismStory[]
  currentStoryId: string | null
}

const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  pending: { icon: "\u25CB", color: "#6b7280" },
  in_progress: { icon: "\u25C9", color: "#3b82f6" },
  complete: { icon: "\u25CF", color: "#22c55e" },
  blocked: { icon: "\u2298", color: "#f59e0b" },
}

export const StoryList: React.FC<StoryListProps> = ({ stories, currentStoryId }) => {
  if (stories.length === 0) {
    return (
      <div
        style={{
          padding: "16px",
          color: "var(--prism-fg-muted)",
          fontSize: "12px",
          textAlign: "center",
        }}
      >
        No stories loaded. Run /decompose_plan to generate stories.json.
      </div>
    )
  }

  // Show a max of 20 stories to keep the list manageable
  const visible = stories.slice(0, 20)
  const hidden = stories.length - visible.length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
      {visible.map((story) => {
        const isActive = story.id === currentStoryId
        const statusMeta = STATUS_ICON[story.status] ?? STATUS_ICON["pending"]

        return (
          <div
            key={story.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 8px",
              borderRadius: "4px",
              backgroundColor: isActive ? "var(--prism-bg-active)" : "transparent",
              border: isActive ? "1px solid #3b82f655" : "1px solid transparent",
              transition: "background-color 0.2s",
            }}
          >
            {/* Status icon */}
            <span
              style={{
                color: statusMeta.color,
                fontSize: "13px",
                flexShrink: 0,
                animation: isActive ? "pulse 1.5s ease-in-out infinite" : undefined,
              }}
            >
              {statusMeta.icon}
            </span>

            {/* Story ID + title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    color: "var(--prism-fg-muted)",
                    fontSize: "10px",
                    fontFamily: "var(--prism-font-mono)",
                    flexShrink: 0,
                  }}
                >
                  {story.id}
                </span>
                <span
                  style={{
                    color: isActive ? "var(--prism-fg-active)" : "var(--prism-fg)",
                    fontSize: "12px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {story.title}
                </span>
              </div>
            </div>

            {/* Priority badge */}
            <span
              style={{
                color: "var(--prism-fg-muted)",
                fontSize: "10px",
                flexShrink: 0,
              }}
            >
              P{story.priority}
            </span>
          </div>
        )
      })}

      {hidden > 0 && (
        <div
          style={{
            padding: "4px 8px",
            color: "var(--prism-fg-muted)",
            fontSize: "11px",
            textAlign: "center",
          }}
        >
          +{hidden} more stories
        </div>
      )}
    </div>
  )
}
