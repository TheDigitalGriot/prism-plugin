import React, { useState } from "react"

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  badge?: string | number
  children: React.ReactNode
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultOpen = true,
  badge,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          padding: "4px 8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--prism-fg-muted)",
        }}
      >
        {/* Chevron */}
        <span
          style={{
            display: "inline-block",
            fontSize: 10,
            transition: "transform 0.15s ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            lineHeight: 1,
          }}
        >
          ›
        </span>

        {/* Title */}
        <span
          style={{
            flex: 1,
            textAlign: "left",
            fontSize: "10.5px",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>

        {/* Badge */}
        {badge !== undefined && (
          <span
            style={{
              fontSize: 10,
              color: "var(--prism-fg-disabled)",
              fontWeight: 500,
            }}
          >
            {badge}
          </span>
        )}
      </button>

      {open && <div>{children}</div>}
    </div>
  )
}
