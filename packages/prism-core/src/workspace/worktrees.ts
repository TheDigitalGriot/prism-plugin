/**
 * Platform-agnostic git worktree management logic.
 *
 * Extracted from cmd/prism-vscode/src/hosts/vscode/PrismPanelProvider.ts.
 * All pure Node.js — no vscode or electron imports.
 *
 * listWorktrees / parsePorcelainWorktrees live in discovery.ts.
 * This module adds createWorktree and deleteWorktree.
 */

import * as child_process from 'child_process';
import * as path from 'path';
import * as util from 'util';

const execAsync = util.promisify(child_process.exec);

// ---------------------------------------------------------------------------
// Create worktree
// ---------------------------------------------------------------------------

/**
 * Create a new git worktree for the given branch.
 *
 * If the branch already exists, attaches to it.
 * If not, creates a new branch with that name.
 *
 * Worktree path convention: `<repoParent>/<repoName>-<safeBranch>`
 * where slashes in the branch name are replaced with hyphens.
 */
export async function createWorktree(workspaceRoot: string, branchName: string): Promise<void> {
  const { stdout: rootOut } = await execAsync('git rev-parse --show-toplevel', {
    cwd: workspaceRoot,
    timeout: 5_000,
  });
  const gitRoot = rootOut.trim();
  const repoName = path.basename(gitRoot);
  const safeBranch = branchName.replace(/\//g, '-');
  const worktreePath = path.join(path.dirname(gitRoot), `${repoName}-${safeBranch}`);

  let branchExists = false;
  try {
    await execAsync(`git -C "${gitRoot}" rev-parse --verify "${branchName}"`, { timeout: 5_000 });
    branchExists = true;
  } catch {
    // Branch doesn't exist — will create it
  }

  if (branchExists) {
    await execAsync(
      `git -C "${gitRoot}" worktree add "${worktreePath}" "${branchName}"`,
      { timeout: 15_000 },
    );
  } else {
    await execAsync(
      `git -C "${gitRoot}" worktree add -b "${branchName}" "${worktreePath}"`,
      { timeout: 15_000 },
    );
  }
}

// ---------------------------------------------------------------------------
// Delete worktree
// ---------------------------------------------------------------------------

/**
 * Remove a git worktree at the given path.
 * Optionally deletes the associated branch after removal.
 */
export async function deleteWorktree(
  workspaceRoot: string,
  worktreePath: string,
  deleteBranch: boolean,
  branchName: string,
): Promise<void> {
  const { stdout: rootOut } = await execAsync('git rev-parse --show-toplevel', {
    cwd: workspaceRoot,
    timeout: 5_000,
  });
  const gitRoot = rootOut.trim();

  await execAsync(`git -C "${gitRoot}" worktree remove "${worktreePath}"`, { timeout: 15_000 });

  if (deleteBranch && branchName) {
    try {
      await execAsync(`git -C "${gitRoot}" branch -D "${branchName}"`, { timeout: 5_000 });
    } catch {
      // Best-effort — branch might be checked out in another worktree
    }
  }
}
