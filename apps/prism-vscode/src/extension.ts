import * as vscode from "vscode"
import { VscodeWebviewProvider } from "./hosts/vscode/VscodeWebviewProvider"
import { PrismPanelProvider } from "./hosts/vscode/PrismPanelProvider"
import { ResearchTreeDataProvider } from "./providers/research-tree"
import { PlansTreeDataProvider } from "./providers/plans-tree"
import { StoriesTreeDataProvider } from "./providers/stories-tree"
import { WorkflowStatusBar } from "./providers/workflow-status"

let _provider: VscodeWebviewProvider | undefined
let _panelProvider: PrismPanelProvider | undefined

/**
 * Extension activation.
 * Called when any activationEvent is triggered (sidebar open or startup).
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const startTime = Date.now()
  console.log("[Prism] Activating extension...")

  // Create the sidebar webview provider (also creates PrismController)
  _provider = new VscodeWebviewProvider(context)
  const controller = _provider.controller

  // ---------------------------------------------------------------------------
  // Phase 5: Tree view providers + status bar
  // ---------------------------------------------------------------------------
  const researchTree = new ResearchTreeDataProvider()
  const plansTree = new PlansTreeDataProvider()
  const storiesTree = new StoriesTreeDataProvider()
  const statusBar = new WorkflowStatusBar()

  context.subscriptions.push(researchTree, plansTree, storiesTree, statusBar)

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("prism.research", researchTree),
    vscode.window.registerTreeDataProvider("prism.plans", plansTree),
    vscode.window.registerTreeDataProvider("prism.stories", storiesTree),
  )

  // Subscribe to file changes → refresh relevant tree + panel webviews
  context.subscriptions.push(
    controller.onDidChangePrismFile((event) => {
      if (event.type === "research") researchTree.refresh()
      if (event.type === "plans") plansTree.refresh()
      if (event.type === "stories") {
        storiesTree.setStories(controller.state.stories)
        _panelProvider?.pushMonitorState()
      }
    }),
  )

  // Subscribe to state changes → update providers + status bar
  context.subscriptions.push(
    controller.onDidChangeState(() => {
      const s = controller.state
      researchTree.setPrismDir(s.prismDir)
      plansTree.setPrismDir(s.prismDir)
      storiesTree.setStories(s.stories)
      statusBar.update({
        phase: s.workflowPhase,
        completedCount: s.completedCount,
        remainingCount: s.remainingCount,
        hasStoriesJson: s.hasStoriesJson,
        spectrum: s.spectrum,
      })
    }),
  )

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

  // ---------------------------------------------------------------------------
  // Unified panel webview provider (bottom panel — Monitor + Workspaces + Office)
  // ---------------------------------------------------------------------------
  _panelProvider = new PrismPanelProvider(context, controller)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PrismPanelProvider.VIEW_ID,
      _panelProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  )

  // Push panel webview state on every controller state change
  context.subscriptions.push(
    controller.onDidChangeState(() => {
      const s = controller.state
      _panelProvider?.pushMonitorState()
      _panelProvider?.updateAgentStatuses(s.office.activeAgents)
    }),
  )

  // ---------------------------------------------------------------------------
  // Commands — workflow phases
  // ---------------------------------------------------------------------------
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

    // Spectrum execution quick-access commands
    vscode.commands.registerCommand("prism.spectrum.start", async () => {
      // Open the Spectrum view — user clicks Start from there
      await _provider?.sendCommandToWebview("startSpectrum")
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.initPrism", async () => {
      await _provider?.sendCommandToWebview("initPrism")
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    // Spectrum pause/stop
    vscode.commands.registerCommand("prism.spectrum.pause", async () => {
      await _provider?.sendCommandToWebview("spectrumPause")
    }),

    vscode.commands.registerCommand("prism.spectrum.stop", async () => {
      await _provider?.sendCommandToWebview("spectrumStop")
    }),

    // Workflow utility commands — invoke Prism plugin skills via CLI
    vscode.commands.registerCommand("prism.commit", async () => {
      await _provider?.sendCommandToWebview("runSkill", { skill: "/commit" })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.decompose", async () => {
      await _provider?.sendCommandToWebview("runSkill", { skill: "/decompose_plan" })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.handoff", async () => {
      await _provider?.sendCommandToWebview("runSkill", { skill: "/create_handoff" })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.describePR", async () => {
      await _provider?.sendCommandToWebview("runSkill", { skill: "/describe_pr" })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),
  )

  // ---------------------------------------------------------------------------
  // Commands — Office
  // ---------------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("prism.office.show", async () => {
      await vscode.commands.executeCommand("prism.mainView.focus")
    }),

    vscode.commands.registerCommand("prism.office.launchAgent", () => {
      _panelProvider?.launchNewTerminal()
    }),

    vscode.commands.registerCommand("prism.office.exportLayout", () => {
      _panelProvider?.exportDefaultLayout()
    }),
  )

  // ---------------------------------------------------------------------------
  // Commands — Monitor panel
  // ---------------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("prism.monitor.runGate", (command?: string) => {
      if (command) void _panelProvider?.runGate(command)
    }),

    vscode.commands.registerCommand("prism.monitor.runAllGates", () => {
      void _panelProvider?.runAllGates()
    }),
  )

  // ---------------------------------------------------------------------------
  // Commands — Workspaces panel
  // ---------------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("prism.workspaces.openProject", async (projectPath?: string) => {
      if (projectPath) {
        await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(projectPath))
      }
    }),

    vscode.commands.registerCommand("prism.workspaces.newWorktree", async () => {
      const branch = await vscode.window.showInputBox({
        prompt: "Branch name for new worktree",
        placeHolder: "feat/my-feature",
      })
      if (branch) await _panelProvider?.createWorktree(branch)
    }),

    vscode.commands.registerCommand("prism.workspaces.deleteWorktree", async (worktreePath?: string) => {
      if (worktreePath) await _panelProvider?.deleteWorktree(worktreePath, false)
    }),
  )

  // ---------------------------------------------------------------------------
  // Commands — Research tree
  // ---------------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("prism.research.open", async (uri: vscode.Uri) => {
      await vscode.commands.executeCommand("markdown.showPreview", uri)
    }),

    vscode.commands.registerCommand("prism.research.delete", async (item) => {
      const filePath: string = item?.filePath
      if (!filePath) return
      const label = typeof item.label === "string" ? item.label : String(item.label)
      const confirm = await vscode.window.showWarningMessage(
        `Delete research document "${label}"?`,
        { modal: true },
        "Delete",
      )
      if (confirm === "Delete") {
        await vscode.workspace.fs.delete(vscode.Uri.file(filePath))
        researchTree.refresh()
      }
    }),

    vscode.commands.registerCommand("prism.research.refresh", () => {
      researchTree.refresh()
    }),
  )

  // ---------------------------------------------------------------------------
  // Commands — Plans tree
  // ---------------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("prism.plans.open", async (uri: vscode.Uri) => {
      await vscode.commands.executeCommand("markdown.showPreview", uri)
    }),

    vscode.commands.registerCommand("prism.plans.decompose", async (item) => {
      const filePath: string = item?.filePath
      if (!filePath) return
      await _provider?.sendCommandToWebview("runSkill", { skill: "/decompose_plan", args: filePath })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.plans.implement", async (item) => {
      const filePath: string = item?.filePath
      if (!filePath) return
      await _provider?.sendCommandToWebview("runSkill", { skill: "/prism-implement", args: filePath })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.plans.delete", async (item) => {
      const filePath: string = item?.filePath
      if (!filePath) return
      const label = typeof item.label === "string" ? item.label : String(item.label)
      const confirm = await vscode.window.showWarningMessage(
        `Delete plan "${label}"?`,
        { modal: true },
        "Delete",
      )
      if (confirm === "Delete") {
        await vscode.workspace.fs.delete(vscode.Uri.file(filePath))
        plansTree.refresh()
      }
    }),

    vscode.commands.registerCommand("prism.plans.refresh", () => {
      plansTree.refresh()
    }),
  )

  // ---------------------------------------------------------------------------
  // Commands — Stories tree
  // ---------------------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand("prism.stories.execute", async (item) => {
      const storyId: string = item?.story?.id
      if (!storyId) return
      await _provider?.sendCommandToWebview("executeStory", { storyId })
      await vscode.commands.executeCommand("prism.sidebar.focus")
    }),

    vscode.commands.registerCommand("prism.stories.markComplete", async (item) => {
      const storyId: string = item?.story?.id
      if (!storyId) return
      const commitHash = await vscode.window.showInputBox({
        prompt: `Commit hash for story ${storyId} (optional)`,
        placeHolder: "abc1234",
      })
      await controller.storiesManager.markComplete(storyId, commitHash ?? "")
      storiesTree.setStories(controller.state.stories)
    }),

    vscode.commands.registerCommand("prism.stories.refresh", () => {
      storiesTree.setStories(controller.state.stories)
    }),
  )

  // Watch for workspace folder changes (re-detect .prism/)
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await controller._detectPrismDir()
    }),
  )

  console.log(`[Prism] Extension activated in ${Date.now() - startTime}ms`)
}

export async function deactivate(): Promise<void> {
  console.log("[Prism] Extension deactivated")
  _provider = undefined
  _panelProvider = undefined
}
