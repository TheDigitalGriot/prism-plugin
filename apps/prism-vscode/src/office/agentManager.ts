import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { AgentState, PersistedAgent, PostMessageFn } from '@prism-core/office/types';
import { cancelWaitingTimer, cancelPermissionTimer } from '@prism-core/office/timerManager';
import { startFileWatching, readNewLines, ensureProjectScan } from './fileWatcher';
import {
	JSONL_POLL_INTERVAL_MS,
	TERMINAL_NAME_PREFIX,
	WORKSPACE_KEY_AGENTS,
	WORKSPACE_KEY_AGENT_SEATS,
	WORKSPACE_KEY_LAYOUT,
} from '@prism-core/office/constants';
import { readLayoutFromFile, writeLayoutToFile } from '@prism-core/office/layoutPersistence';

export function getProjectDirPath(cwd?: string): string | null {
	const workspacePath = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspacePath) return null;
	const dirName = workspacePath.replace(/[:\\/]/g, '-');
	return path.join(os.homedir(), '.claude', 'projects', dirName);
}

export function launchNewTerminal(
	nextAgentIdRef: { current: number },
	nextTerminalIndexRef: { current: number },
	agents: Map<number, AgentState>,
	activeAgentIdRef: { current: number | null },
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	postMessage: PostMessageFn | undefined,
	persistAgentsFn: () => void,
): void {
	const idx = nextTerminalIndexRef.current++;
	const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	const terminal = vscode.window.createTerminal({
		name: `${TERMINAL_NAME_PREFIX} #${idx}`,
		cwd,
	});
	terminal.show();

	const sessionId = crypto.randomUUID();
	terminal.sendText(`claude --session-id ${sessionId}`);

	const projectDir = getProjectDirPath(cwd);
	if (!projectDir) {
		console.log(`[Prism Office] No project dir, cannot track agent`);
		return;
	}

	// Pre-register expected JSONL file so project scan won't treat it as a /clear file
	const expectedFile = path.join(projectDir, `${sessionId}.jsonl`);
	knownJsonlFiles.add(expectedFile);

	// Create agent immediately (before JSONL file exists)
	const id = nextAgentIdRef.current++;
	const agent: AgentState = {
		id,
		terminalRef: terminal,
		projectDir,
		jsonlFile: expectedFile,
		fileOffset: 0,
		lineBuffer: '',
		activeToolIds: new Set(),
		activeToolStatuses: new Map(),
		activeToolNames: new Map(),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		isWaiting: false,
		permissionSent: false,
		hadToolsInTurn: false,
	};

	agents.set(id, agent);
	activeAgentIdRef.current = id;
	persistAgentsFn();
	console.log(`[Prism Office] Agent ${id}: created for terminal ${terminal.name}`);
	postMessage?.({ type: 'agentCreated', id });

	ensureProjectScan(
		projectDir, knownJsonlFiles, projectScanTimerRef, activeAgentIdRef,
		nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
		postMessage, persistAgentsFn,
	);

	// Poll for the specific JSONL file to appear
	const pollTimer = setInterval(() => {
		try {
			if (fs.existsSync(agent.jsonlFile)) {
				console.log(`[Prism Office] Agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`);
				clearInterval(pollTimer);
				jsonlPollTimers.delete(id);
				startFileWatching(id, agent.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, postMessage);
				readNewLines(id, agents, waitingTimers, permissionTimers, postMessage);
			}
		} catch { /* file may not exist yet */ }
	}, JSONL_POLL_INTERVAL_MS);
	jsonlPollTimers.set(id, pollTimer);
}

export function removeAgent(
	agentId: number,
	agents: Map<number, AgentState>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	persistAgentsFn: () => void,
): void {
	const agent = agents.get(agentId);
	if (!agent) return;

	// Stop JSONL poll timer
	const jpTimer = jsonlPollTimers.get(agentId);
	if (jpTimer) { clearInterval(jpTimer); }
	jsonlPollTimers.delete(agentId);

	// Stop file watching
	fileWatchers.get(agentId)?.close();
	fileWatchers.delete(agentId);
	const pt = pollingTimers.get(agentId);
	if (pt) { clearInterval(pt); }
	pollingTimers.delete(agentId);

	// Cancel timers
	cancelWaitingTimer(agentId, waitingTimers);
	cancelPermissionTimer(agentId, permissionTimers);

	// Remove from maps
	agents.delete(agentId);
	persistAgentsFn();
}

export function persistAgents(
	agents: Map<number, AgentState>,
	context: vscode.ExtensionContext,
): void {
	const persisted: PersistedAgent[] = [];
	for (const agent of agents.values()) {
		// Skip headless Spectrum agents — they're transient and have no terminal to restore
		if (!agent.terminalRef) continue;
		const terminal = agent.terminalRef as vscode.Terminal;
		persisted.push({
			id: agent.id,
			terminalName: terminal.name,
			jsonlFile: agent.jsonlFile,
			projectDir: agent.projectDir,
		});
	}
	void context.workspaceState.update(WORKSPACE_KEY_AGENTS, persisted);
}

/**
 * Create a headless agent for a Spectrum story (no VS Code terminal).
 * Registers the expected JSONL path and polls until Claude writes the file.
 * Returns the new agent ID.
 */
export function createHeadlessAgent(
	sessionId: string,
	projectDir: string,
	nextAgentIdRef: { current: number },
	agents: Map<number, AgentState>,
	knownJsonlFiles: Set<string>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	postMessage: PostMessageFn | undefined,
): number {
	const expectedFile = path.join(projectDir, `${sessionId}.jsonl`);
	knownJsonlFiles.add(expectedFile);

	const id = nextAgentIdRef.current++;
	const agent: AgentState = {
		id,
		terminalRef: null,
		projectDir,
		jsonlFile: expectedFile,
		fileOffset: 0,
		lineBuffer: '',
		activeToolIds: new Set(),
		activeToolStatuses: new Map(),
		activeToolNames: new Map(),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		isWaiting: false,
		permissionSent: false,
		hadToolsInTurn: false,
	};

	agents.set(id, agent);
	postMessage?.({ type: 'agentCreated', id });
	console.log(`[Prism Office] Headless agent ${id}: created for Spectrum session ${sessionId}`);

	// Poll until Claude creates the JSONL transcript file
	const pollTimer = setInterval(() => {
		try {
			if (fs.existsSync(agent.jsonlFile)) {
				console.log(`[Prism Office] Headless agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`);
				clearInterval(pollTimer);
				jsonlPollTimers.delete(id);
				startFileWatching(id, agent.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, postMessage);
				readNewLines(id, agents, waitingTimers, permissionTimers, postMessage);
			}
		} catch { /* file may not exist yet */ }
	}, JSONL_POLL_INTERVAL_MS);
	jsonlPollTimers.set(id, pollTimer);

	return id;
}

export function restoreAgents(
	context: vscode.ExtensionContext,
	nextAgentIdRef: { current: number },
	nextTerminalIndexRef: { current: number },
	agents: Map<number, AgentState>,
	knownJsonlFiles: Set<string>,
	fileWatchers: Map<number, fs.FSWatcher>,
	pollingTimers: Map<number, ReturnType<typeof setInterval>>,
	waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
	permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
	jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
	projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
	activeAgentIdRef: { current: number | null },
	postMessage: PostMessageFn | undefined,
	doPersist: () => void,
): void {
	const persisted = context.workspaceState.get<PersistedAgent[]>(WORKSPACE_KEY_AGENTS, []);
	if (persisted.length === 0) return;

	const liveTerminals = vscode.window.terminals;
	let maxId = 0;
	let maxIdx = 0;
	let restoredProjectDir: string | null = null;

	for (const p of persisted) {
		const terminal = liveTerminals.find(t => t.name === p.terminalName);
		if (!terminal) continue;

		const agent: AgentState = {
			id: p.id,
			terminalRef: terminal,
			projectDir: p.projectDir,
			jsonlFile: p.jsonlFile,
			fileOffset: 0,
			lineBuffer: '',
			activeToolIds: new Set(),
			activeToolStatuses: new Map(),
			activeToolNames: new Map(),
			activeSubagentToolIds: new Map(),
			activeSubagentToolNames: new Map(),
			isWaiting: false,
			permissionSent: false,
			hadToolsInTurn: false,
		};

		agents.set(p.id, agent);
		knownJsonlFiles.add(p.jsonlFile);
		console.log(`[Prism Office] Restored agent ${p.id} → terminal "${p.terminalName}"`);

		if (p.id > maxId) maxId = p.id;
		// Extract terminal index from name like "Claude Code #3"
		const match = p.terminalName.match(/#(\d+)$/);
		if (match) {
			const idx = parseInt(match[1], 10);
			if (idx > maxIdx) maxIdx = idx;
		}

		restoredProjectDir = p.projectDir;

		// Start file watching if JSONL exists, skipping to end of file
		try {
			if (fs.existsSync(p.jsonlFile)) {
				const stat = fs.statSync(p.jsonlFile);
				agent.fileOffset = stat.size;
				startFileWatching(p.id, p.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, postMessage);
			} else {
				// Poll for the file to appear
				const pollTimer = setInterval(() => {
					try {
						if (fs.existsSync(agent.jsonlFile)) {
							console.log(`[Prism Office] Restored agent ${p.id}: found JSONL file`);
							clearInterval(pollTimer);
							jsonlPollTimers.delete(p.id);
							const stat = fs.statSync(agent.jsonlFile);
							agent.fileOffset = stat.size;
							startFileWatching(p.id, agent.jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, postMessage);
						}
					} catch { /* file may not exist yet */ }
				}, JSONL_POLL_INTERVAL_MS);
				jsonlPollTimers.set(p.id, pollTimer);
			}
		} catch { /* ignore errors during restore */ }
	}

	// Advance counters past restored IDs
	if (maxId >= nextAgentIdRef.current) {
		nextAgentIdRef.current = maxId + 1;
	}
	if (maxIdx >= nextTerminalIndexRef.current) {
		nextTerminalIndexRef.current = maxIdx + 1;
	}

	// Re-persist cleaned-up list (removes entries whose terminals are gone)
	doPersist();

	// Start project scan for /clear detection
	if (restoredProjectDir) {
		ensureProjectScan(
			restoredProjectDir, knownJsonlFiles, projectScanTimerRef, activeAgentIdRef,
			nextAgentIdRef, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers,
			postMessage, doPersist,
		);
	}
}

export function sendExistingAgents(
	agents: Map<number, AgentState>,
	context: vscode.ExtensionContext,
	postMessage: PostMessageFn | undefined,
): void {
	if (!postMessage) return;
	const agentIds: number[] = [];
	for (const id of agents.keys()) {
		agentIds.push(id);
	}
	agentIds.sort((a, b) => a - b);

	// Include persisted palette/seatId from separate key
	const agentMeta = context.workspaceState.get<Record<string, { palette?: number; seatId?: string }>>(WORKSPACE_KEY_AGENT_SEATS, {});
	console.log(`[Prism Office] sendExistingAgents: agents=${JSON.stringify(agentIds)}, meta=${JSON.stringify(agentMeta)}`);

	postMessage({
		type: 'existingAgents',
		agents: agentIds,
		agentMeta,
	});

	sendCurrentAgentStatuses(agents, postMessage);
}

export function sendCurrentAgentStatuses(
	agents: Map<number, AgentState>,
	postMessage: PostMessageFn | undefined,
): void {
	if (!postMessage) return;
	for (const [agentId, agent] of agents) {
		// Re-send active tools
		for (const [toolId, status] of agent.activeToolStatuses) {
			postMessage({
				type: 'agentToolStart',
				id: agentId,
				toolId,
				status,
			});
		}
		// Re-send waiting status
		if (agent.isWaiting) {
			postMessage({
				type: 'agentStatus',
				id: agentId,
				status: 'waiting',
			});
		}
	}
}

/**
 * Send layout to webview.
 * Handles VSCode-specific migration from workspaceState if no layout file exists yet.
 */
export function sendLayout(
	context: vscode.ExtensionContext,
	postMessage: PostMessageFn | undefined,
	defaultLayout?: Record<string, unknown> | null,
): void {
	if (!postMessage) return;

	let layout = readLayoutFromFile();
	if (!layout) {
		// VSCode-specific: migrate from workspaceState if it exists
		const fromState = context.workspaceState.get<Record<string, unknown>>(WORKSPACE_KEY_LAYOUT);
		if (fromState) {
			console.log('[Prism Office] Migrating layout from workspace state to file');
			writeLayoutToFile(fromState);
			void context.workspaceState.update(WORKSPACE_KEY_LAYOUT, undefined);
			layout = fromState;
		} else if (defaultLayout) {
			console.log('[Prism Office] Writing bundled default layout to file');
			writeLayoutToFile(defaultLayout);
			layout = defaultLayout;
		}
	} else {
		console.log('[Prism Office] Layout loaded from file');
	}

	postMessage({ type: 'layoutLoaded', layout });
}
