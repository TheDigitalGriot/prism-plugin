import React, { useCallback, useEffect, useRef, useState } from "react"
import { usePrismState, type WorkflowPhase } from "@prism-ui/context/PrismStateContext"
import { WorkflowServiceClient, type WorkflowTransition } from "@prism-ui/services/grpc-client"
import { StatusDot } from "../common/StatusDot"

// ---------------------------------------------------------------------------
// Phase button metadata
// ---------------------------------------------------------------------------

const PHASES: Array<{
  key: WorkflowPhase
  label: string
  color: string
  transition: WorkflowTransition
}> = [
  { key: "research", label: "Research", color: "#3b82f6", transition: "start_research" },
  { key: "plan", label: "Plan", color: "#14b8a6", transition: "start_plan" },
  { key: "implement", label: "Implement", color: "#22c55e", transition: "start_implement" },
  { key: "validate", label: "Validate", color: "#f59e0b", transition: "start_validate" },
]

// ---------------------------------------------------------------------------
// API key popover
// ---------------------------------------------------------------------------

const ApiKeyPopover: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [keyInput, setKeyInput] = useState("")
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load current key status on mount
  useEffect(() => {
    void (async () => {
      try {
        const key = await window.electronAPI?.invoke("prism:getApiKey") as string | undefined
        setHasKey(!!key)
      } catch {
        setHasKey(false)
      }
    })()
    // Auto-focus the input
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const validate = (v: string): string | null => {
    if (!v) return "API key is required"
    if (!v.startsWith("sk-ant-") || v.length <= 20)
      return "Must start with sk-ant- and be longer than 20 chars"
    return null
  }

  const handleSave = useCallback(async () => {
    const err = validate(keyInput)
    if (err) { setError(err); return }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await window.electronAPI?.invoke("prism:setApiKey", keyInput) as { ok: boolean; error?: string }
      if (result?.ok) {
        setHasKey(true)
        setKeyInput("")
        setSuccess("API key saved securely.")
      } else {
        setError(result?.error ?? "Failed to save key")
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }, [keyInput])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await window.electronAPI?.invoke("prism:deleteApiKey") as { ok: boolean; error?: string }
      if (result?.ok) {
        setHasKey(false)
        setSuccess("API key removed.")
      } else {
        setError(result?.error ?? "Failed to delete key")
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setDeleting(false)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleSave()
  }, [handleSave])

  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        top: 38,
        right: 8,
        zIndex: 1000,
        width: 320,
        backgroundColor: "var(--prism-bg-panel)",
        border: "1px solid var(--prism-border)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--prism-fg)" }}>
          API Key Settings
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: hasKey ? "#22c55e" : "var(--prism-fg-muted)",
          }}
        >
          {hasKey === null ? "…" : hasKey ? "● Key set" : "○ No key"}
        </span>
      </div>

      {/* Input */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 10, color: "var(--prism-fg-muted)" }}>
          Anthropic API key
        </label>
        <input
          ref={inputRef}
          type="password"
          value={keyInput}
          onChange={(e) => { setKeyInput(e.target.value); setError(null); setSuccess(null) }}
          onKeyDown={handleKeyDown}
          placeholder="sk-ant-..."
          style={{
            height: 28,
            padding: "0 8px",
            fontSize: 11,
            fontFamily: "monospace",
            backgroundColor: "var(--prism-bg-input, #1a1a2e)",
            color: "var(--prism-fg)",
            border: error ? "1px solid #ef4444" : "1px solid var(--prism-border)",
            borderRadius: 4,
            outline: "none",
          }}
        />
        {error && (
          <span style={{ fontSize: 10, color: "#ef4444" }}>{error}</span>
        )}
        {success && (
          <span style={{ fontSize: 10, color: "#22c55e" }}>{success}</span>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => void handleSave()}
          disabled={saving || !keyInput}
          style={{
            flex: 1,
            height: 26,
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
            border: "none",
            backgroundColor: saving || !keyInput ? "var(--prism-border)" : "#3b82f6",
            color: saving || !keyInput ? "var(--prism-fg-muted)" : "#fff",
            cursor: saving || !keyInput ? "default" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {saving ? "Saving…" : "Save Key"}
        </button>
        {hasKey && (
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            style={{
              height: 26,
              padding: "0 10px",
              fontSize: 11,
              fontWeight: 500,
              borderRadius: 4,
              border: "1px solid #ef444455",
              backgroundColor: "transparent",
              color: deleting ? "var(--prism-fg-muted)" : "#ef4444",
              cursor: deleting ? "default" : "pointer",
            }}
          >
            {deleting ? "…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeaderBar — 34px top header with project name, RPIV phase buttons, status
// ---------------------------------------------------------------------------

export const HeaderBar: React.FC = () => {
  const state = usePrismState()
  const currentPhase = state.workflowPhase
  const [showApiKeyPopover, setShowApiKeyPopover] = useState(false)

  // Extract folder basename from prismDir path
  const projectName = state.prismDir
    ? state.prismDir.replace(/\\/g, "/").split("/").filter(Boolean).slice(-1)[0] || "Prism"
    : "Prism"

  const handlePhaseClick = async (transition: WorkflowTransition) => {
    try {
      await WorkflowServiceClient.transition(transition)
    } catch (err) {
      console.error("[Prism] Phase transition failed:", err)
    }
  }

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
        position: "relative",
      }}
    >
      {/* Left: Spectral accent stripe + project name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
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
          {projectName}
        </span>
      </div>

      {/* Center spacer */}
      <div style={{ flex: 1 }} />

      {/* Center: RPIV phase buttons */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {PHASES.map(({ key, label, color, transition }) => {
          const isActive = currentPhase === key

          return (
            <button
              key={key}
              onClick={() => void handlePhaseClick(transition)}
              title={`Switch to ${label} phase`}
              style={{
                height: 22,
                padding: "0 8px",
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? color : "var(--prism-fg-muted)",
                backgroundColor: isActive ? `${color}22` : "transparent",
                border: isActive ? `1px solid ${color}44` : "1px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Center spacer */}
      <div style={{ flex: 1 }} />

      {/* Right: Status dot + label + settings gear */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <StatusDot status={state.hasActiveTask ? "running" : "pending"} size={6} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: state.hasActiveTask ? "var(--prism-amber)" : "var(--prism-fg-muted)",
          }}
        >
          {state.hasActiveTask ? "RUNNING" : "IDLE"}
        </span>

        {/* Settings gear button */}
        <button
          onClick={() => setShowApiKeyPopover((v) => !v)}
          title="API Key Settings"
          style={{
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            border: showApiKeyPopover
              ? "1px solid var(--prism-border)"
              : "1px solid transparent",
            backgroundColor: showApiKeyPopover ? "var(--prism-bg-hover, #ffffff0f)" : "transparent",
            cursor: "pointer",
            color: showApiKeyPopover ? "var(--prism-fg)" : "var(--prism-fg-muted)",
            fontSize: 13,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ⚙
        </button>
      </div>

      {/* API Key popover */}
      {showApiKeyPopover && (
        <ApiKeyPopover onClose={() => setShowApiKeyPopover(false)} />
      )}
    </div>
  )
}
