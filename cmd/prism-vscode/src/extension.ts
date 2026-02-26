import * as vscode from "vscode"
import { VscodeWebviewProvider } from "./hosts/vscode/VscodeWebviewProvider"

let _provider: VscodeWebviewProvider | undefined

/**
 * Extension activation.
 * Called when any activationEvent is triggered (sidebar open or startup).
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const startTime = Date.now()
  console.log("[Prism] Activating extension...")

  // Create the sidebar webview provider (also creates PrismController)
  _provider = new VscodeWebviewProvider(context)

  // Register webview view provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VscodeWebviewProvider.SIDEBAR_ID,
      _provider,
      {
        webviewOptions: {
          // Keep webview alive when hidden (preserves React state, active subscriptions)
          retainContextWhenHidden: true,
        },
      },
    ),
  )

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("prism.openSidebar", async () => {
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.research", async () => {
      await _provider?.sendCommandToWebview("startPhase", { phase: "research" })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.plan", async () => {
      await _provider?.sendCommandToWebview("startPhase", { phase: "plan" })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.implement", async () => {
      await _provider?.sendCommandToWebview("startPhase", { phase: "implement" })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.validate", async () => {
      await _provider?.sendCommandToWebview("startPhase", { phase: "validate" })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.spectrum", async () => {
      await _provider?.sendCommandToWebview("startSpectrum")
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.initPrism", async () => {
      await _provider?.sendCommandToWebview("initPrism")
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),
  )

  // Watch for workspace folder changes (re-detect .prism/)
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await _provider?.controller._detectPrismDir()
    }),
  )

  console.log(`[Prism] Extension activated in ${Date.now() - startTime}ms`)
}

export async function deactivate(): Promise<void> {
  console.log("[Prism] Extension deactivated")
  _provider = undefined
}
