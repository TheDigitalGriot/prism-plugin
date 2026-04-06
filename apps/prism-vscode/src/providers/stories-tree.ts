/**
 * StoriesTreeDataProvider — lists stories from stories.json.
 *
 * Color-coded status icons:
 *   pending    → gray circle
 *   in_progress → blue spinner
 *   complete   → green checkmark
 *   blocked    → amber lock
 *
 * Expandable to show steps with checkboxes.
 * Refreshes when PrismController calls refresh() after stories.json changes.
 */

import * as vscode from "vscode"
import { Story, Step } from "@prism-core/prism/stories"
import { isBlocked } from "@prism-core/prism/stories"

// ---------------------------------------------------------------------------
// Tree item union
// ---------------------------------------------------------------------------

export type StoriesTreeNode = StoryItem | StepItem

// ---------------------------------------------------------------------------
// StoryItem — top-level story row
// ---------------------------------------------------------------------------

export class StoryItem extends vscode.TreeItem {
  constructor(
    public readonly story: Story,
    public readonly allStories: Story[],
  ) {
    const blocked = story.status !== "complete" && isBlocked(story, allStories)
    const effectiveStatus = blocked ? "blocked" : story.status

    super(
      `${story.id}: ${story.title}`,
      story.steps.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    )

    this.description = StoryItem._descriptionFor(story)
    this.tooltip = story.description || story.title
    this.iconPath = StoryItem._iconFor(effectiveStatus)
    this.contextValue = `story_${effectiveStatus}`
  }

  private static _descriptionFor(story: Story): string {
    const done = story.steps.filter((s) => s.done).length
    const total = story.steps.length
    if (total === 0) return ""
    return `${done}/${total} steps`
  }

  private static _iconFor(status: string): vscode.ThemeIcon {
    switch (status) {
      case "complete":
        return new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("charts.green"))
      case "in_progress":
        return new vscode.ThemeIcon("sync~spin", new vscode.ThemeColor("charts.blue"))
      case "blocked":
        return new vscode.ThemeIcon("lock", new vscode.ThemeColor("charts.yellow"))
      default:
        // pending
        return new vscode.ThemeIcon("circle-large-outline", new vscode.ThemeColor("disabledForeground"))
    }
  }
}

// ---------------------------------------------------------------------------
// StepItem — child step row under a story
// ---------------------------------------------------------------------------

export class StepItem extends vscode.TreeItem {
  constructor(
    public readonly step: Step,
    public readonly storyId: string,
    public readonly stepIndex: number,
  ) {
    super(step.description, vscode.TreeItemCollapsibleState.None)

    this.iconPath = step.done
      ? new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"))
      : new vscode.ThemeIcon("circle-outline", new vscode.ThemeColor("disabledForeground"))
    this.contextValue = "storyStep"
    this.tooltip = step.done ? "Done" : "Pending"
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class StoriesTreeDataProvider
  implements vscode.TreeDataProvider<StoriesTreeNode>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<StoriesTreeNode | undefined | null | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private _stories: Story[] = []

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  /** Called by the controller whenever stories state updates. */
  setStories(stories: Story[]): void {
    this._stories = stories
    this.refresh()
  }

  getTreeItem(element: StoriesTreeNode): vscode.TreeItem {
    return element
  }

  getChildren(element?: StoriesTreeNode): StoriesTreeNode[] {
    if (!element) {
      // Root: all stories sorted by priority
      const sorted = [...this._stories].sort((a, b) => a.priority - b.priority)
      return sorted.map((s) => new StoryItem(s, this._stories))
    }

    if (element instanceof StoryItem) {
      // Children: steps
      return element.story.steps.map(
        (step, idx) => new StepItem(step, element.story.id, idx),
      )
    }

    return []
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose()
  }
}
