/**
 * Platform-agnostic plans file discovery + frontmatter parsing.
 *
 * Extracted from cmd/prism-vscode/src/providers/plans-tree.ts.
 * All pure Node.js — no vscode or electron imports.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanItem {
  filename: string;
  date: string;
  feature: string;
  status: string;
  phases: number;
  filePath: string;
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

interface PlanFrontmatter {
  date: string;
  feature: string;
  status: string;
  phases: number;
}

function parsePlanFrontmatter(content: string): PlanFrontmatter {
  const defaults: PlanFrontmatter = { date: '', feature: '', status: '', phases: 0 };
  const lines = content.split('\n');

  if (lines[0]?.trim() !== '---') return defaults;

  const result: PlanFrontmatter = { date: '', feature: '', status: '', phases: 0 };

  for (let i = 1; i < Math.min(lines.length, 40); i++) {
    if (lines[i]?.trim() === '---') break;
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx === -1) continue;
    const key = lines[i].slice(0, colonIdx).trim();
    const value = lines[i].slice(colonIdx + 1).trim().replace(/"/g, '');

    if (key === 'date') result.date = value.slice(0, 10);
    else if (key === 'feature') result.feature = value;
    else if (key === 'status') result.status = value;
    else if (key === 'phases') result.phases = parseInt(value, 10) || 0;
  }

  return result;
}

function featureFromFilename(filePath: string): string {
  const base = path.basename(filePath, '.md');
  const withoutDate = base.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  // Also strip ticket prefix like ENG-1234-
  return withoutDate.replace(/^[A-Z]+-\d+-/, '').replace(/-/g, ' ');
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Discover all plan documents in a .prism directory.
 * Reads .prism/shared/plans/ and returns parsed metadata.
 * Results are sorted newest-first by filename.
 */
export async function discoverPlans(prismDir: string): Promise<PlanItem[]> {
  const plansDir = path.join(prismDir, 'shared', 'plans');

  let filenames: string[];
  try {
    const entries = await fs.promises.readdir(plansDir);
    filenames = entries
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse(); // newest first
  } catch {
    return [];
  }

  const items: PlanItem[] = [];

  for (const filename of filenames) {
    const filePath = path.join(plansDir, filename);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const fm = parsePlanFrontmatter(content);
      const feature = fm.feature || featureFromFilename(filePath);
      items.push({ filename, date: fm.date, feature, status: fm.status, phases: fm.phases, filePath });
    } catch {
      // Skip unreadable files
    }
  }

  return items;
}
