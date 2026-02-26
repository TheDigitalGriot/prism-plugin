import * as vscode from "vscode"
import { randomBytes } from "crypto"

/** Generate a cryptographic nonce for CSP script tags. */
export function getNonce(): string {
  return randomBytes(16).toString("base64")
}

/**
 * Abstract base for webview content generation.
 * VS Code-specific implementation is in VscodeWebviewProvider.
 */
export abstract class WebviewProvider {
  /**
   * Generate the full HTML page for the webview.
   * Called once by resolveWebviewView() after the webview is available.
   */
  abstract getHtmlContent(webview: vscode.Webview): string

  /** Handle an incoming message from the webview. */
  abstract handleMessage(message: unknown): Promise<void>

  /** Post a message to the webview. */
  abstract sendToWebview(message: unknown): Promise<void>
}
