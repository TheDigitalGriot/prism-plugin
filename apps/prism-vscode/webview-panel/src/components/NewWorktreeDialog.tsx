import React, { useState, useRef, useEffect } from 'react'
import { vscode } from '../vscodeApi'

interface NewWorktreeDialogProps {
  onCancel: () => void
}

export function NewWorktreeDialog({ onCancel }: NewWorktreeDialogProps): React.ReactElement {
  const [branch, setBranch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const trimmed = branch.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    vscode.postMessage({ type: 'createWorktree', branch: trimmed })
    // Reset after sending — the provider will refresh the list
    setTimeout(() => {
      setSubmitting(false)
      onCancel()
    }, 500)
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') onCancel()
  }

  return (
    <form className="new-worktree-dialog" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        className="new-worktree-input"
        type="text"
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
        placeholder="feat/my-branch"
        disabled={submitting}
        aria-label="Branch name"
      />
      <div className="new-worktree-actions">
        <button
          type="submit"
          className="new-worktree-create-btn"
          disabled={!branch.trim() || submitting}
        >
          {submitting ? '…' : 'Create'}
        </button>
        <button
          type="button"
          className="new-worktree-cancel-btn"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
