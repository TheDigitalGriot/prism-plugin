import * as child_process from 'child_process';
import * as util from 'util';

const execAsync = util.promisify(child_process.exec);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GateResult {
  success: boolean;
  output: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// Gate execution
// ---------------------------------------------------------------------------

/**
 * Execute a quality gate command in the given working directory.
 * Resolves with success/failure, truncated output, and duration.
 * Timeout: 60 seconds.
 */
export async function executeGate(command: string, cwd: string): Promise<GateResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, { cwd, timeout: 60_000 });
    return {
      success: true,
      output: truncateOutput(stdout + stderr, 50),
      duration: Date.now() - start,
    };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string };
    const combined = (execErr.stdout ?? '') + (execErr.stderr ?? execErr.message ?? '');
    return {
      success: false,
      output: truncateOutput(combined, 50),
      duration: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a human-readable label from a gate command string. */
export function gateLabel(command: string): string {
  const first = command.trim().split(/\s+/)[0] ?? command;
  const map: Record<string, string> = {
    test: 'Tests',
    build: 'Build',
    lint: 'Lint',
    tsc: 'TypeScript',
    typecheck: 'TypeCheck',
  };
  for (const [key, label] of Object.entries(map)) {
    if (command.includes(key)) return label;
  }
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function truncateOutput(output: string, lines: number): string {
  const all = output.trimEnd().split('\n');
  return all.slice(-lines).join('\n');
}
