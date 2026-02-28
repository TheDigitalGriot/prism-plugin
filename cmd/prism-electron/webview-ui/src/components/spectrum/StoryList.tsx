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
  pending: { icon: "○", color: "#6b7280" },
  in_progress: { icon: "◉", color: "#3b82f6" },
  complete: { icon: "●", color: "#22c55e" },
  blocked: { icon: "⊘", color: "#f59e0b" },
}

export const StoryList: React.FC<StoryListProps> = ({ stories, currentStoryId }) => {
  if (stories.length === 0) {
    return (
      <div
        style={{
          padding: "16px",
          color: "var(--vscode-descriptionForeground)",
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
              backgroundColor: isActive
                ? "var(--vscode-list-activeSelectionBackground, #1e3a5f)"
                : "transparent",
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
                    color: "var(--vscode-descriptionForeground)",
                    fontSize: "10px",
                    fontFamily: "var(--vscode-editor-font-family, monospace)",
                    flexShrink: 0,
                  }}
                >
                  {story.id}
                </span>
                <span
                  style={{
                    color: isActive
                      ? "var(--vscode-list-activeSelectionForeground, white)"
                      : "var(--vscode-foreground)",
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
                color: "var(--vscode-descriptionForeground)",
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
            color: "var(--vscode-descriptionForeground)",
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
