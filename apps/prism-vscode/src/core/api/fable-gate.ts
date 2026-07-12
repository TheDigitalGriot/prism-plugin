/**
 * Fable 5 request gate.
 *
 * Fable 5 costs ~2.6× Opus per call, so it must never run silently. This module
 * resolves the model that will actually be used for a request:
 *
 * - Any non-Fable model passes through unchanged.
 * - Fable is only permitted when the workspace flag is enabled AND the user
 *   explicitly confirms a native VS Code modal.
 * - On a missing workspace root, a disabled flag, a denied modal, or a
 *   dismissed modal, the request falls back to Opus. It is never blocked.
 */
import * as vscode from "vscode"
import { isFableEnabled } from "./fable-flag"
import type { ModelName } from "./claude-sdk"

/**
 * Resolve the model to use for a request, gating Fable behind the flag + a
 * confirm/deny modal.
 *
 * @param requested      - The model the caller asked for.
 * @param workspaceRoot  - Active workspace root; `undefined` => Fable disabled.
 * @returns `"fable"` only when enabled and explicitly confirmed; otherwise the
 *          requested model unchanged (non-Fable) or `"opus"` (Fable fallback).
 */
export async function resolveGatedModel(
  requested: ModelName,
  workspaceRoot: string | undefined,
): Promise<ModelName> {
  // Non-Fable requests are never gated.
  if (requested !== "fable") {
    return requested
  }

  // Fable unavailable without a workspace root or with the flag off: no modal,
  // silently fall back to Opus.
  if (!workspaceRoot || !isFableEnabled(workspaceRoot)) {
    return "opus"
  }

  // Flag on: require explicit confirmation. Any non-Confirm result
  // (Deny, or the modal being dismissed) falls back to Opus.
  const choice = await vscode.window.showWarningMessage(
    "Fable 5 requested — ~2.6× Opus cost for this call.",
    { modal: true },
    "Confirm",
    "Deny",
  )

  return choice === "Confirm" ? "fable" : "opus"
}
