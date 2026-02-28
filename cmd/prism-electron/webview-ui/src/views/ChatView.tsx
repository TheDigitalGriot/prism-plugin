import React, { useState, useRef, useEffect, useCallback } from "react"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import { usePrismState, PrismChatMessage } from "../context/PrismStateContext"
import { ChatServiceClient } from "../services/grpc-client"
import { ChatRow } from "../components/chat/ChatRow"
import { ChatTextArea } from "../components/chat/ChatTextArea"
import { PhaseIndicator, PhaseTransition } from "../components/workflow/PhaseIndicator"

// ---------------------------------------------------------------------------
// CliNotFound — shown when Claude CLI is not installed
// ---------------------------------------------------------------------------

const CliNotFound: React.FC = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: "24px",
      gap: "16px",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: "24px" }}>&#x2699;</div>
    <div style={{ fontWeight: 600, fontSize: "14px" }}>Claude CLI Not Found</div>
    <div style={{ color: "var(--prism-fg-muted)", fontSize: "12px", maxWidth: "300px" }}>
      Prism uses your Claude Max subscription via the Claude CLI. Install it and log in to get started.
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "320px", fontSize: "12px" }}>
      <div style={{
        padding: "8px 12px",
        borderRadius: "6px",
        backgroundColor: "var(--prism-bg-hover)",
        fontFamily: "var(--prism-font-mono)",
        textAlign: "left",
      }}>
        <div style={{ color: "var(--prism-fg-muted)", marginBottom: "4px" }}>1. Install Claude Code:</div>
        <div>npm install -g @anthropic-ai/claude-code</div>
        <div style={{ color: "var(--prism-fg-muted)", marginTop: "8px", marginBottom: "4px" }}>2. Log in with your Max subscription:</div>
        <div>claude login</div>
      </div>
    </div>
    <div style={{ color: "var(--prism-fg-muted)", fontSize: "11px", maxWidth: "300px" }}>
      After installing and logging in, restart Prism to detect the CLI.
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// EmptyChat — shown when no messages yet
// ---------------------------------------------------------------------------

const EmptyChat: React.FC<{ phase: string }> = ({ phase }) => {
  const suggestions: Record<string, string[]> = {
    idle: [
      "What does this codebase do?",
      "Help me understand the architecture",
      "What are the main components?",
    ],
    research: [
      "Document the overall architecture",
      "Map out the data flow",
      "List all external dependencies",
    ],
    plan: [
      "Create an implementation plan for...",
      "What questions do we need to resolve?",
      "Review the research and propose next steps",
    ],
    implement: [
      "Load the current plan and start Phase 1",
      "Continue from where we left off",
      "What's the next step in the plan?",
    ],
    validate: [
      "Run all automated verification commands",
      "Check the implementation against the plan",
      "Generate a validation report",
    ],
  }

  const phaseSuggestions = suggestions[phase] ?? suggestions.idle

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "24px",
        gap: "16px",
      }}
    >
      <div
        style={{
          fontSize: "28px",
          background: "linear-gradient(135deg, #3b82f6, #14b8a6, #22c55e)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontWeight: 700,
          letterSpacing: "0.1em",
        }}
      >
        PRISM
      </div>
      <div
        style={{
          color: "var(--prism-fg-muted)",
          fontSize: "12px",
          textAlign: "center",
        }}
      >
        Ask anything, or try one of these:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", maxWidth: "300px" }}>
        {phaseSuggestions.map((suggestion) => (
          <button
            key={suggestion}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--prism-border)",
              backgroundColor: "var(--prism-bg)",
              color: "var(--prism-fg)",
              cursor: "pointer",
              fontSize: "12px",
              textAlign: "left",
            }}
            onClick={() => {
              // Dispatch to parent via custom event
              window.dispatchEvent(new CustomEvent("prism-suggestion", { detail: suggestion }))
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChatView — main chat interface
// ---------------------------------------------------------------------------

export const ChatView: React.FC = () => {
  const state = usePrismState()
  const [inputText, setInputText] = useState("")
  const [isAtBottom, setIsAtBottom] = useState(true)
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const messages = state.chatMessages
  const isStreaming = state.isChatStreaming
  const pendingApproval = state.pendingApprovalToolUseId

  // Listen for suggestion clicks from EmptyChat
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string>
      setInputText(ce.detail)
    }
    window.addEventListener("prism-suggestion", handler)
    return () => window.removeEventListener("prism-suggestion", handler)
  }, [])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      virtuosoRef.current?.scrollToIndex({
        index: messages.length - 1,
        behavior: "smooth",
      })
    }
  }, [messages.length, isAtBottom])

  const handleSend = useCallback(async () => {
    const text = inputText.trim()
    if (!text || isStreaming) return

    setInputText("")

    try {
      const result = await ChatServiceClient.sendMessage(text)
      if (!result.ok) {
        console.error("[Prism] sendMessage failed:", result.error)
      }
    } catch (err) {
      console.error("[Prism] sendMessage error:", err)
    }
  }, [inputText, isStreaming])

  const handleAbort = useCallback(async () => {
    try {
      await ChatServiceClient.abortTask()
    } catch (err) {
      console.error("[Prism] abortTask error:", err)
    }
  }, [])

  const handleClear = useCallback(async () => {
    try {
      await ChatServiceClient.clearMessages()
    } catch (err) {
      console.error("[Prism] clearMessages error:", err)
    }
  }, [])

  const handleApproveToolUse = useCallback(async (toolUseId: string, approved: boolean) => {
    try {
      await ChatServiceClient.approveToolUse(toolUseId, approved)
    } catch (err) {
      console.error("[Prism] approveToolUse error:", err)
    }
  }, [])

  // Show CLI not found if Claude CLI is not installed
  if (!state.hasClaudeCli) {
    return <CliNotFound />
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Phase indicator header */}
      <PhaseIndicator currentPhase={state.workflowPhase} />

      {/* Phase transition buttons */}
      <PhaseTransition currentPhase={state.workflowPhase} />

      {/* Chat header actions */}
      {state.hasActiveTask && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "4px 12px",
            gap: "8px",
            borderBottom: "1px solid var(--prism-border)",
          }}
        >
          <button
            onClick={() => void handleClear()}
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              border: "1px solid var(--prism-border)",
              backgroundColor: "transparent",
              color: "var(--prism-fg-muted)",
              cursor: "pointer",
              fontSize: "11px",
            }}
          >
            New chat
          </button>
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {messages.length === 0 ? (
          <EmptyChat phase={state.workflowPhase} />
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            atBottomStateChange={setIsAtBottom}
            itemContent={(_index: number, message: PrismChatMessage) => (
              <div style={{ padding: "4px 12px" }}>
                <ChatRow
                  message={message}
                  onApproveToolUse={
                    pendingApproval === message.toolUseId
                      ? handleApproveToolUse
                      : undefined
                  }
                />
              </div>
            )}
            style={{ height: "100%" }}
            followOutput="smooth"
          />
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          padding: "8px",
          borderTop: "1px solid var(--prism-border)",
          backgroundColor: "var(--prism-bg-panel)",
        }}
      >
        {isStreaming ? (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <div
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "var(--prism-bg-input)",
                color: "var(--prism-fg-muted)",
                fontSize: "12px",
                border: "1px solid var(--prism-border)",
              }}
            >
              Claude is thinking…
            </div>
            <button
              onClick={() => void handleAbort()}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ef4444",
                backgroundColor: "#ef444422",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "12px",
                flexShrink: 0,
              }}
            >
              Stop
            </button>
          </div>
        ) : (
          <ChatTextArea
            value={inputText}
            onChange={setInputText}
            onSubmit={() => void handleSend()}
            disabled={isStreaming}
            placeholder={`Message Prism (${state.workflowPhase} mode)…`}
          />
        )}

        {/* Input hints */}
        <div
          style={{
            fontSize: "10px",
            color: "var(--prism-fg-muted)",
            marginTop: "4px",
            textAlign: "right",
          }}
        >
          Enter to send · Shift+Enter for newline
        </div>
      </div>
    </div>
  )
}
