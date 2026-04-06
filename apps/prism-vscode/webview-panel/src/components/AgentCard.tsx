import React from 'react'
import type { AgentStatus } from '../types/monitor'
import { StatusIcon } from './StatusIcon'

interface AgentCardProps {
  agent: AgentStatus
}

export function AgentCard({ agent }: AgentCardProps): React.ReactElement {
  const branch = agent.worktreePath
    ? agent.worktreePath.split('/').pop() ?? agent.worktreePath
    : undefined

  return (
    <div className="agent-card-inner">
      <div className="agent-card-header">
        <span className="agent-type-badge">{agent.agentType}</span>
        <StatusIcon status={agent.status} size={8} />
      </div>
      {agent.storyId && (
        <div className="agent-card-story">
          <span className="agent-story-id">{agent.storyId}</span>
          {agent.storyTitle && (
            <span className="agent-story-title" title={agent.storyTitle}>
              {agent.storyTitle.length > 30 ? agent.storyTitle.slice(0, 30) + '…' : agent.storyTitle}
            </span>
          )}
        </div>
      )}
      {branch && <div className="agent-card-branch">{branch}</div>}
    </div>
  )
}
