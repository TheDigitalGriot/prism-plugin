/**
 * StateService handler registration.
 *
 * Handlers are registered directly in PrismController._registerHandlers().
 * This file documents the protocol contract.
 *
 * StateService.subscribeToState:
 *   Request:  {} (empty)
 *   Response: { stateJson: string } — JSON-serialized PrismExtensionState
 *   Mode:     streaming (is_streaming: true for all chunks)
 *   Notes:    First response sent immediately on subscribe. Subsequent
 *             responses sent whenever controller.updateState() is called.
 *
 * StateService.getState:
 *   Request:  {} (empty)
 *   Response: { stateJson: string }
 *   Mode:     unary
 *
 * UiService.initializeWebview:
 *   Request:  {} (empty)
 *   Response: { ok: boolean }
 *   Mode:     unary
 *   Notes:    Called by webview on mount to trigger workspace detection.
 */

export {}
