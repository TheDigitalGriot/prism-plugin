export interface AgentStatus {
  id: number
  sessionId?: string
  storyId?: string
  storyTitle?: string
  agentType: string      // "claude" | "codex" | "cursor"
  status: string         // "active" | "thinking" | "waiting" | "done" | "paused"
  worktreePath?: string
}

export interface ExecutionRecord {
  storyId: string
  storyTitle: string
  result: 'complete' | 'error' | 'blocked'
  durationMs: number
  completedAt: string    // ISO timestamp
  commitHash?: string
}

export interface QualityGate {
  name: string           // derived from command (e.g., "npm test" → "Tests")
  command: string        // raw command string from stories.json
  status: 'unknown' | 'pass' | 'fail' | 'running' | 'pending'
  lastRun?: string       // ISO timestamp
  output?: string        // captured stdout+stderr (truncated to last 50 lines)
  durationMs?: number
}

export interface MonitorState {
  agents: AgentStatus[]
  history: ExecutionRecord[]
  gates: QualityGate[]
}
