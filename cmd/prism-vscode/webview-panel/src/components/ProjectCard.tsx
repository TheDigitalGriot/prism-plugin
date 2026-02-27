import React, { useState } from 'react'
import type { ProjectInfo } from '../types/workspaces'
import { ProgressBar } from './ProgressBar'
import { vscode } from '../vscodeApi'

interface ProjectCardProps {
  project: ProjectInfo
}

export function ProjectCard({ project }: ProjectCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const ratio = project.storiesTotal > 0 ? project.storiesComplete / project.storiesTotal : 0
  const label = `${project.storiesComplete}/${project.storiesTotal} stories`

  function openProject(): void {
    vscode.postMessage({ type: 'openProject', path: project.path })
  }

  return (
    <div className={`project-card${project.isCurrent ? ' project-card--current' : ''}`}>
      <div className="project-card-header">
        <div className="project-card-title-row">
          {project.isCurrent && <span className="project-current-dot" title="Current workspace">●</span>}
          <span className="project-name">{project.name}</span>
          <span className="project-branch-badge">{project.branch}</span>
        </div>
        <div className="project-card-actions">
          {project.epics.length > 0 && (
            <button
              className="project-expand-btn"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse epics' : 'Expand epics'}
            >
              {expanded ? '▾' : '▸'} {project.epics.length} epic{project.epics.length !== 1 ? 's' : ''}
            </button>
          )}
          <button className="project-open-btn" onClick={openProject}>Open</button>
        </div>
      </div>

      {project.storiesTotal > 0 && (
        <div className="project-card-progress">
          <ProgressBar value={ratio} label={label} size="sm" />
        </div>
      )}
      {project.storiesTotal === 0 && (
        <div className="project-no-stories">No stories</div>
      )}

      {expanded && project.epics.length > 0 && (
        <ul className="project-epics">
          {project.epics.map((epic) => {
            const epicRatio = epic.storyCount > 0 ? epic.completedCount / epic.storyCount : 0
            return (
              <li key={epic.name} className="project-epic-item">
                <span className="project-epic-name">{epic.name}</span>
                <ProgressBar
                  value={epicRatio}
                  label={`${epic.completedCount}/${epic.storyCount}`}
                  size="sm"
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
