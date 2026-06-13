import { describe, it, expect, vi } from "vitest";
import { AgentRunClient, agentsBrokered, type AgentRunTransport } from "./agent-run";

function mockTransport(timeline: Array<{ kind: string; data: unknown }>): AgentRunTransport {
  return {
    call: vi.fn(async (_service: string, method: string) => {
      if (method === "create_agent") return { agentId: "a1" };
      if (method === "send_agent_message") return { ok: true };
      if (method === "cancel_agent") return { ok: true };
      return {};
    }),
    stream: async function* () {
      for (const ev of timeline) yield { event: ev };
    },
  };
}

describe("AgentRunClient (full-managed step 1 — substrate proof)", () => {
  it("drives create → send → stream → terminal signal through the transport", async () => {
    const transport = mockTransport([
      { kind: "assistant_message", data: "working on it" },
      { kind: "tool_call", data: { tool: "read", path: "src/x.ts" } },
      { kind: "assistant_message", data: "done <promise>COMPLETE</promise>" },
    ]);
    const client = new AgentRunClient(transport);

    const handle = await client.createAgent({ cwd: "/proj", systemPrompt: "phase:implement" });
    expect(handle.agentId).toBe("a1");
    expect(transport.call).toHaveBeenCalledWith("agent-run", "create_agent", {
      cwd: "/proj",
      systemPrompt: "phase:implement",
    });

    await client.sendMessage(handle.agentId, "implement STORY-001");
    expect(transport.call).toHaveBeenCalledWith("agent-run", "send_agent_message", {
      agentId: "a1",
      text: "implement STORY-001",
    });

    const events: string[] = [];
    let finalText = "";
    for await (const ev of client.streamTimeline(handle.agentId)) {
      events.push(ev.kind);
      if (ev.kind === "assistant_message") finalText = String(ev.data);
    }
    expect(events).toEqual(["assistant_message", "tool_call", "assistant_message"]);
    // Prism's signal parser would read the terminal token from the final assistant text.
    expect(finalText).toContain("<promise>COMPLETE</promise>");
  });

  it("throws if create_agent returns no agentId", async () => {
    const transport: AgentRunTransport = {
      call: async () => ({}),
      stream: async function* () {},
    };
    await expect(new AgentRunClient(transport).createAgent({ cwd: "/p" })).rejects.toThrow("no agentId");
  });

  it("normalizes non-object stream frames", async () => {
    const transport: AgentRunTransport = {
      call: async () => ({ agentId: "a1" }),
      stream: async function* () {
        yield { event: "raw string chunk" };
      },
    };
    const out: Array<{ kind: string; data: unknown }> = [];
    for await (const ev of new AgentRunClient(transport).streamTimeline("a1")) out.push(ev);
    expect(out).toEqual([{ kind: "data", data: "raw string chunk" }]);
  });

  it("agentsBrokered is OFF by default and on with the flag", () => {
    expect(agentsBrokered({})).toBe(false);
    expect(agentsBrokered({ PRISM_AGENTS_BROKERED: "1" })).toBe(true);
    expect(agentsBrokered({ PRISM_AGENTS_BROKERED: "true" })).toBe(true);
    expect(agentsBrokered({ PRISM_AGENTS_BROKERED: "0" })).toBe(false);
  });
});
