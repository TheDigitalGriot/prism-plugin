/**
 * ResearchTreeDataProvider — lists .prism/shared/research/ markdown files.
 *
 * Shows date, topic, and tags parsed from YAML frontmatter.
 * Refreshes automatically when the PrismWatcher fires a "research" change event.
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { getPrismConfig } from "../prism/config"

// ---------------------------------------------------------------------------
// Tree item types
// ---------------------------------------------------------------------------

export class ResearchItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly date: string,
    public readonly topic: string,
    public readonly tags: string[],
  ) {
    super(topic || path.basename(filePath, ".md"), vscode.TreeItemCollapsibleState.None)

    this.description = date
    this.tooltip = tags.length > 0 ? `Tags: ${tags.join(", ")}` : filePath
    this.iconPath = new vscode.ThemeIcon("file-text")
    this.contextValue = "researchDoc"

    // Open file in editor on click
    this.command = {
      command: "prism.research.open",
      title: "Open Research Document",
      arguments: [vscode.Uri.file(filePath)],
    }
  }
}

// ---------------------------------------------------------------------------
// YAML frontmatter parsing
// ---------------------------------------------------------------------------

interface ResearchFrontmatter {
  date: string
  topic: string
  tags: string[]
}

/**
 * Extract YAML frontmatter fields from a markdown file.
 * Only reads the first 40 lines for performance.
 */
async function parseFrontmatter(filePath: string): Promise<ResearchFrontmatter> {
  const defaults: ResearchFrontmatter = { date: "", topic: "", tags: [] }

  try {
    const content = await fs.readFile(filePath, "utf-8")
    const lines = content.split("\n")

    // Must start with ---
    if (lines[0]?.trim() !== "---") {
      return defaults
    }

    const frontmatterLines: string[] = []
    for (let i = 1; i < Math.min(lines.length, 40); i++) {
      if (lines[i]?.trim() === "---") break
      frontmatterLines.push(lines[i])
    }

    const result: ResearchFrontmatter = { date: "", topic: "", tags: [] }

    for (const line of frontmatterLines) {
      const colonIdx = line.indexOf(":")
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()

      if (key === "date") {
        // ISO date string — show just YYYY-MM-DD
        result.date = value.slice(0, 10).replace(/"/g, "")
      } else if (key === "topic") {
        result.topic = value.replace(/"/g, "")
      } else if (key === "tags") {
        // Parse YAML array: [tag1, tag2] or - tag per line
        const match = value.match(/\[([^\]]*)\]/)
        if (match) {
          result.tags = match[1]
            .split(",")
            .map((t) => t.trim().replace(/"/g, ""))
            .filter(Boolean)
        }
      }
    }

    return result
  } catch {
    return defaults
  }
}

/**
 * Derive a human-readable topic from the filename if frontmatter lacks one.
 * e.g. "2026-02-26-prism-vscode-extension-architecture" → "prism vscode extension architecture"
 */
function topicFromFilename(filePath: string): string {
  const base = path.basename(filePath, ".md")
  // Remove date prefix YYYY-MM-DD-
  const withoutDate = base.replace(/^\d{4}-\d{2}-\d{2}-/, "")
  return withoutDate.replace(/-/g, " ")
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class ResearchTreeDataProvider
  implements vscode.TreeDataProvider<ResearchItem>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<ResearchItem | undefined | null | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private _prismDir: string | undefined

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  /** Called by the controller when .prism/ is detected or changes. */
  setPrismDir(prismDir: string | undefined): void {
    this._prismDir = prismDir
    this.refresh()
  }

  getTreeItem(element: ResearchItem): vscode.TreeItem {
    return element
  }

  async getChildren(_element?: ResearchItem): Promise<ResearchItem[]> {
    if (!this._prismDir) {
      return []
    }

    const researchDir = getPrismConfig(this._prismDir).researchDir

    let files: string[]
    try {
      const entries = await fs.readdir(researchDir)
      files = entries
        .filter((f) => f.endsWith(".md"))
        .map((f) => path.join(researchDir, f))
        .sort()
        .reverse() // Newest first
    } catch {
      // Directory doesn't exist yet
      return []
    }

    const items: ResearchItem[] = []
    for (const filePath of files) {
      const fm = await parseFrontmatter(filePath)
      const topic = fm.topic || topicFromFilename(filePath)
      const date = fm.date || ""
      items.push(new ResearchItem(filePath, date, topic, fm.tags))
    }

    return items
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose()
  }
}
