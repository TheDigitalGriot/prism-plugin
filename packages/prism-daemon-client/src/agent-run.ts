/**
 * AgentRunClient — the brokered agent-execution substrate.
 *
 * This is "full-managed, step 1" from the capability-parity analysis
 * (.prism/shared/research/2026-06-13-full-managed-capability-parity.md): a thin, typed
 * surface for driving ONE agent turn through the broker's `agent-run` service —
 * create → send → stream timeline → cancel — so Prism's orchestration (Spectrum,
 * the 4-phase workflow, the signal protocol, PluginBridge, Office) can stay exactly
 * where it is and merely SWAP its execution call from in-process to brokered.
 *
 * It is transport-injected (matching DaemonClient's `call`/`stream` shape) so it
 * unit-tests headless and works unchanged against the live DaemonClient. It does NOT
 * touch the in-process PrismTask loop — gated entirely by `agentsBrokered()`,
 * default OFF, so the proven-in-process path is the default until parity is verified
 * against the real paseo daemon (step 2).
 */

export const AGENT_RUN = "agent-run";

/** Minimal transport surface — satisfied structurally by `DaemonClient`. */
export interface AgentRunTransport {
  call(service: string, method: string, payload?: unknown): Promise<unknown>;
  stream(service: string, method: string, payload?: unknown): AsyncIterable<{ event?: unknown }>;
}

export interface AgentRunHandle {
  agentId: string;
}

export interface AgentTimelineEvent {
  kind: string;
  data: unknown;
}

export interface CreateAgentOptions {
  cwd: string;
  /** Prism's phase system prompt (research/plan/implement/validate) — stays Prism-owned. */
  systemPrompt?: string;
  provider?: string;
}

export class AgentRunClient {
  constructor(private readonly transport: AgentRunTransport) {}

  /** Create a brokered agent session. */
  async createAgent(opts: CreateAgentOptions): Promise<AgentRunHandle> {
    const res = (await this.transport.call(AGENT_RUN, "create_agent", opts)) as { agentId?: string };
    if (!res || typeof res.agentId !== "string") {
      throw new Error("agent-run: create_agent returned no agentId");
    }
    return { agentId: res.agentId };
  }

  /** Send a user message to the agent. */
  async sendMessage(agentId: string, text: string): Promise<void> {
    await this.transport.call(AGENT_RUN, "send_agent_message", { agentId, text });
  }

  /**
   * Stream the agent's timeline (assistant turns, tool calls, the trailing signal).
   * Prism's signal parser reads `<spectrum-*>` / `<promise>` from the final assistant text.
   */
  async *streamTimeline(agentId: string): AsyncGenerator<AgentTimelineEvent> {
    for await (const frame of this.transport.stream(AGENT_RUN, "fetch_agent_timeline", { agentId })) {
      const ev = frame.event;
      if (ev && typeof ev === "object" && "kind" in ev) {
        yield ev as AgentTimelineEvent;
      } else {
        yield { kind: "data", data: ev };
      }
    }
  }

  async cancel(agentId: string): Promise<void> {
    await this.transport.call(AGENT_RUN, "cancel_agent", { agentId });
  }
}

/**
 * Whether agent execution should route through the broker. Default OFF — the in-process
 * loop stays the default until brokered parity is verified against the real paseo daemon.
 * Flip with `PRISM_AGENTS_BROKERED=1`.
 */
export function agentsBrokered(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.PRISM_AGENTS_BROKERED;
  return v === "1" || v === "true";
}
