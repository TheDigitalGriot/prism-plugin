/**
 * Platform-agnostic research file discovery + frontmatter parsing.
 *
 * Extracted from cmd/prism-vscode/src/providers/research-tree.ts.
 * All pure Node.js — no vscode or electron imports.
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchItem {
  filename: string;
  date: string;
  topic: string;
  tags: string[];
  status: string;
  filePath: string;
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

interface ResearchFrontmatter {
  date: string;
  topic: string;
  tags: string[];
  status: string;
}

function parseResearchFrontmatter(content: string): ResearchFrontmatter {
  const defaults: ResearchFrontmatter = { date: '', topic: '', tags: [], status: '' };
  const lines = content.split('\n');

  if (lines[0]?.trim() !== '---') return defaults;

  const result: ResearchFrontmatter = { date: '', topic: '', tags: [], status: '' };

  for (let i = 1; i < Math.min(lines.length, 40); i++) {
    if (lines[i]?.trim() === '---') break;
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx === -1) continue;
    const key = lines[i].slice(0, colonIdx).trim();
    const value = lines[i].slice(colonIdx + 1).trim();

    if (key === 'date') {
      result.date = value.slice(0, 10).replace(/"/g, '');
    } else if (key === 'topic') {
      result.topic = value.replace(/"/g, '');
    } else if (key === 'status') {
      result.status = value.replace(/"/g, '');
    } else if (key === 'tags') {
      const match = value.match(/\[([^\]]*)\]/);
      if (match) {
        result.tags = match[1]
          .split(',')
          .map((t) => t.trim().replace(/"/g, ''))
          .filter(Boolean);
      }
    }
  }

  return result;
}

function topicFromFilename(filePath: string): string {
  const base = path.basename(filePath, '.md');
  const withoutDate = base.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return withoutDate.replace(/-/g, ' ');
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/**
 * Discover all research documents in a .prism directory.
 * Reads .prism/shared/research/ and returns parsed metadata.
 * Results are sorted newest-first by filename.
 */
export async function discoverResearch(prismDir: string): Promise<ResearchItem[]> {
  const researchDir = path.join(prismDir, 'shared', 'research');

  let filenames: string[];
  try {
    const entries = await fs.promises.readdir(researchDir);
    filenames = entries
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse(); // newest first
  } catch {
    return [];
  }

  const items: ResearchItem[] = [];

  for (const filename of filenames) {
    const filePath = path.join(researchDir, filename);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const fm = parseResearchFrontmatter(content);
      const topic = fm.topic || topicFromFilename(filePath);
      const date = fm.date || '';
      items.push({ filename, date, topic, tags: fm.tags, status: fm.status, filePath });
    } catch {
      // Skip unreadable files
    }
  }

  return items;
}
