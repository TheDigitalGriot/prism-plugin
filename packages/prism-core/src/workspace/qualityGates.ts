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
  cancelled?: boolean;
}

// ---------------------------------------------------------------------------
// Gate execution
// ---------------------------------------------------------------------------

/**
 * Execute a quality gate command in the given working directory.
 * Resolves with success/failure, truncated output, and duration.
 *
 * @param command  Shell command to execute
 * @param cwd      Working directory
 * @param signal   Optional AbortSignal — if aborted, the gate is killed and
 *                 `cancelled: true` is returned instead of a failure.
 *
 * Timeout: 60 seconds (hard limit, independent of signal).
 */
export async function executeGate(
  command: string,
  cwd: string,
  signal?: AbortSignal,
): Promise<GateResult> {
  const start = Date.now();

  if (signal?.aborted) {
    return { success: false, output: 'Cancelled', duration: 0, cancelled: true };
  }

  try {
    const execOptions: child_process.ExecOptions = { cwd, timeout: 60_000 };
    // node child_process exec supports AbortSignal via `options.signal` in Node 16+
    if (signal) {
      (execOptions as Record<string, unknown>).signal = signal;
    }
    const { stdout, stderr } = await execAsync(command, execOptions);
    return {
      success: true,
      output: truncateOutput(String(stdout) + String(stderr), 50),
      duration: Date.now() - start,
    };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string; code?: string };
    // ABORT_ERR is thrown when the AbortSignal fires
    if (execErr.code === 'ABORT_ERR' || signal?.aborted) {
      return {
        success: false,
        output: 'Cancelled',
        duration: Date.now() - start,
        cancelled: true,
      };
    }
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
