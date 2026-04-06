/**
 * PlansTreeDataProvider — lists .prism/shared/plans/ markdown files.
 *
 * Shows date, feature name, and completion status parsed from YAML frontmatter.
 * Context menu: Open, Decompose to Stories, Implement, Delete.
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { getPrismConfig } from "../prism/config"

// ---------------------------------------------------------------------------
// Tree item
// ---------------------------------------------------------------------------

export class PlanItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly date: string,
    public readonly feature: string,
    public readonly status: string,
  ) {
    super(feature || path.basename(filePath, ".md"), vscode.TreeItemCollapsibleState.None)

    this.description = date
    this.tooltip = `Status: ${status || "draft"}\n${filePath}`

    // Icon varies by status
    this.iconPath = this._iconForStatus(status)
    this.contextValue = "planDoc"

    this.command = {
      command: "prism.plans.open",
      title: "Open Plan",
      arguments: [vscode.Uri.file(filePath)],
    }
  }

  private _iconForStatus(status: string): vscode.ThemeIcon {
    switch (status) {
      case "complete":
        return new vscode.ThemeIcon("check-all", new vscode.ThemeColor("charts.green"))
      case "in_progress":
        return new vscode.ThemeIcon("sync~spin", new vscode.ThemeColor("charts.blue"))
      case "approved":
        return new vscode.ThemeIcon("thumbsup", new vscode.ThemeColor("charts.yellow"))
      default:
        return new vscode.ThemeIcon("notebook", new vscode.ThemeColor("foreground"))
    }
  }
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

interface PlanFrontmatter {
  date: string
  feature: string
  status: string
}

async function parsePlanFrontmatter(filePath: string): Promise<PlanFrontmatter> {
  const defaults: PlanFrontmatter = { date: "", feature: "", status: "" }

  try {
    const content = await fs.readFile(filePath, "utf-8")
    const lines = content.split("\n")

    if (lines[0]?.trim() !== "---") {
      return defaults
    }

    const result: PlanFrontmatter = { date: "", feature: "", status: "" }

    for (let i = 1; i < Math.min(lines.length, 40); i++) {
      if (lines[i]?.trim() === "---") break
      const colonIdx = lines[i].indexOf(":")
      if (colonIdx === -1) continue
      const key = lines[i].slice(0, colonIdx).trim()
      const value = lines[i].slice(colonIdx + 1).trim().replace(/"/g, "")

      if (key === "date") result.date = value.slice(0, 10)
      else if (key === "feature") result.feature = value
      else if (key === "status") result.status = value
    }

    return result
  } catch {
    return defaults
  }
}

function featureFromFilename(filePath: string): string {
  const base = path.basename(filePath, ".md")
  const withoutDate = base.replace(/^\d{4}-\d{2}-\d{2}-/, "")
  // Also strip ticket prefix like ENG-1234-
  return withoutDate.replace(/^[A-Z]+-\d+-/, "").replace(/-/g, " ")
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class PlansTreeDataProvider
  implements vscode.TreeDataProvider<PlanItem>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<PlanItem | undefined | null | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private _prismDir: string | undefined

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  setPrismDir(prismDir: string | undefined): void {
    this._prismDir = prismDir
    this.refresh()
  }

  getTreeItem(element: PlanItem): vscode.TreeItem {
    return element
  }

  async getChildren(_element?: PlanItem): Promise<PlanItem[]> {
    if (!this._prismDir) {
      return []
    }

    const plansDir = getPrismConfig(this._prismDir).plansDir

    let files: string[]
    try {
      const entries = await fs.readdir(plansDir)
      files = entries
        .filter((f) => f.endsWith(".md"))
        .map((f) => path.join(plansDir, f))
        .sort()
        .reverse()
    } catch {
      return []
    }

    const items: PlanItem[] = []
    for (const filePath of files) {
      const fm = await parsePlanFrontmatter(filePath)
      const feature = fm.feature || featureFromFilename(filePath)
      items.push(new PlanItem(filePath, fm.date, feature, fm.status))
    }

    return items
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose()
  }
}
