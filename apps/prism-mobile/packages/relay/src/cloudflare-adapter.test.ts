import { afterEach, describe, expect, it, vi } from "vitest";
import relayWorker, { RelayDurableObject } from "./cloudflare-adapter.js";

type DurableObjectStateArg = ConstructorParameters<typeof RelayDurableObject>[0];
type RelayEnvArg = Parameters<typeof relayWorker.fetch>[1];

type MockSocket = WebSocket & {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  serializeAttachment: ReturnType<typeof vi.fn>;
  deserializeAttachment: ReturnType<typeof vi.fn>;
};

function createMockSocket(attachment: unknown = null): MockSocket {
  let storedAttachment = attachment;
  return {
    send: vi.fn(),
    close: vi.fn(),
    serializeAttachment: vi.fn((value: unknown) => {
      storedAttachment = value;
    }),
    deserializeAttachment: vi.fn(() => storedAttachment),
  } as unknown as MockSocket;
}

function createMockState() {
  const socketsByTag = new Map<string, WebSocket[]>();
  const state = {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn((tag?: string): WebSocket[] => {
      if (!tag) {
        const out: WebSocket[] = [];
        for (const sockets of socketsByTag.values()) out.push(...sockets);
        return out;
      }
      return socketsByTag.get(tag) ?? [];
    }),
  };

  return {
    state,
    setTagSockets: (tag: string, sockets: WebSocket[]) => {
      socketsByTag.set(tag, sockets);
    },
  };
}

async function withMockWebSocketPair(
  run: (sockets: { clientWs: MockSocket; serverWs: MockSocket }) => Promise<void> | void,
): Promise<void> {
  const serverWs = createMockSocket();
  const clientWs = createMockSocket();
  const WebSocketPairMock = class {
    [index: number]: WebSocket;
    constructor() {
      this[0] = clientWs as unknown as WebSocket;
      this[1] = serverWs as unknown as WebSocket;
    }
  };

  const previousPair = (globalThis as unknown as { WebSocketPair?: unknown }).WebSocketPair;
  (globalThis as unknown as { WebSocketPair: unknown }).WebSocketPair = WebSocketPairMock;
  try {
    await run({ clientWs, serverWs });
  } finally {
    if (previousPair === undefined) {
      delete (globalThis as unknown as { WebSocketPair?: unknown }).WebSocketPair;
    } else {
      (globalThis as unknown as { WebSocketPair: unknown }).WebSocketPair = previousPair;
    }
  }
}

const swallow = () => undefined;

describe("RelayDurableObject versioning", () => {
  it("accepts legacy v1 client sockets without connectionId", async () => {
    const { state } = createMockState();
    await withMockWebSocketPair(async () => {
      const relay = new RelayDurableObject(state as unknown as DurableObjectStateArg);
      const req = new Request("https://relay.test/ws?role=client&serverId=srv_test&v=1", {
        headers: {
          Upgrade: "websocket",
        },
      });
      await relay.fetch(req).catch(swallow);
      expect(state.acceptWebSocket).toHaveBeenCalled();
    });
  });

  it("assigns a connectionId when v2 client connects without one", async () => {
    const { state } = createMockState();
    await withMockWebSocketPair(async ({ serverWs }) => {
      const relay = new RelayDurableObject(state as unknown as DurableObjectStateArg);
      const req = new Request("https://relay.test/ws?role=client&serverId=srv_test&v=2", {
        headers: { Upgrade: "websocket" },
      });
      await relay.fetch(req).catch(swallow);
      expect(state.acceptWebSocket).toHaveBeenCalled();
      const attachment = serverWs.deserializeAttachment();
      expect(attachment).toMatchObject({
        role: "client",
        connectionId: expect.stringMatching(/^conn_/),
      });
    });
  });
});

describe("RelayDurableObject control nudge/reset behavior", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not nudge or reset control after the client already disconnected", () => {
    vi.useFakeTimers();
    const clientId = "clt_stale_timer";
    const control = createMockSocket();
    const { state, setTagSockets } = createMockState();

    setTagSockets("server-control", [control]);
    setTagSockets("client", []);
    setTagSockets(`client:${clientId}`, []);
    setTagSockets(`server:${clientId}`, []);

    const relay = new RelayDurableObject(state as unknown as DurableObjectStateArg);
    (
      relay as unknown as { nudgeOrResetControlForConnection(id: string): void }
    ).nudgeOrResetControlForConnection(clientId);

    vi.advanceTimersByTime(15_000);

    expect(control.send).not.toHaveBeenCalled();
    expect(control.close).not.toHaveBeenCalled();
  });

  it("resets control when the client remains connected but no server-data socket appears", () => {
    vi.useFakeTimers();
    const clientId = "clt_waiting_for_daemon";
    const control = createMockSocket();
    const client = createMockSocket({
      role: "client",
      connectionId: clientId,
      serverId: "srv_test",
      createdAt: Date.now(),
    });
    const { state, setTagSockets } = createMockState();

    setTagSockets("server-control", [control]);
    setTagSockets("client", [client]);
    setTagSockets(`client:${clientId}`, [client]);
    setTagSockets(`server:${clientId}`, []);

    const relay = new RelayDurableObject(state as unknown as DurableObjectStateArg);
    (
      relay as unknown as { nudgeOrResetControlForConnection(id: string): void }
    ).nudgeOrResetControlForConnection(clientId);

    vi.advanceTimersByTime(10_000);
    expect(control.send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(control.close).toHaveBeenCalledWith(1011, "Control unresponsive");
  });

  it("does not replace existing client sockets for the same connectionId", async () => {
    const existingClient = createMockSocket({
      version: "2",
      role: "client",
      connectionId: "clt_same_session",
      serverId: "srv_test",
      createdAt: Date.now(),
    });
    const { state, setTagSockets } = createMockState();
    setTagSockets("client:clt_same_session", [existingClient]);
    setTagSockets("client", [existingClient]);

    await withMockWebSocketPair(async () => {
      const relay = new RelayDurableObject(state as unknown as DurableObjectStateArg);
      const req = new Request(
        "https://relay.test/ws?role=client&serverId=srv_test&connectionId=clt_same_session&v=2",
        {
          headers: {
            Upgrade: "websocket",
          },
        },
      );

      await relay.fetch(req).catch(swallow);
      expect(existingClient.close).not.toHaveBeenCalled();
    });
  });

  it("keeps server data socket alive while at least one client socket remains", () => {
    const clientId = "clt_multi";
    const disconnectedClient = createMockSocket({
      version: "2",
      role: "client",
      connectionId: clientId,
      serverId: "srv_test",
      createdAt: Date.now(),
    });
    const stillConnectedClient = createMockSocket({
      version: "2",
      role: "client",
      connectionId: clientId,
      serverId: "srv_test",
      createdAt: Date.now(),
    });
    const serverData = createMockSocket();
    const control = createMockSocket();
    const { state, setTagSockets } = createMockState();

    setTagSockets("server-control", [control]);
    setTagSockets(`server:${clientId}`, [serverData]);
    setTagSockets("client", [stillConnectedClient]);
    setTagSockets(`client:${clientId}`, [stillConnectedClient]);

    const relay = new RelayDurableObject(state as unknown as DurableObjectStateArg);
    relay.webSocketClose(
      disconnectedClient as unknown as WebSocket,
      1001,
      "Client disconnected",
      true,
    );

    expect(serverData.close).not.toHaveBeenCalled();
    expect(control.send).not.toHaveBeenCalledWith(
      JSON.stringify({ type: "disconnected", connectionId: clientId }),
    );
  });
});

describe("relay worker endpoint routing", () => {
  it("routes missing v to legacy v1 isolated DO ids", async () => {
    const fetch = vi.fn(
      async (request: Request) => new Response(`ok:${new URL(request.url).searchParams.get("v")}`),
    );
    const get = vi.fn(() => ({ fetch }));
    const idFromName = vi.fn(() => ({ toString: () => "id" }));

    const response = await relayWorker.fetch(
      new Request("https://relay.test/ws?serverId=srv_test&role=server"),
      { RELAY: { idFromName, get } } as unknown as RelayEnvArg,
    );

    expect(idFromName).toHaveBeenCalledWith("relay-v1:srv_test");
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(response.text()).resolves.toBe("ok:1");
  });

  it("routes v=2 to v2 isolated DO ids", async () => {
    const fetch = vi.fn(
      async (request: Request) => new Response(`ok:${new URL(request.url).searchParams.get("v")}`),
    );
    const get = vi.fn(() => ({ fetch }));
    const idFromName = vi.fn(() => ({ toString: () => "id" }));

    const response = await relayWorker.fetch(
      new Request("https://relay.test/ws?serverId=srv_test&role=server&v=2"),
      { RELAY: { idFromName, get } } as unknown as RelayEnvArg,
    );

    expect(idFromName).toHaveBeenCalledWith("relay-v2:srv_test");
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(response.text()).resolves.toBe("ok:2");
  });

  it("rejects invalid v values", async () => {
    const fetch = vi.fn();
    const get = vi.fn(() => ({ fetch }));
    const idFromName = vi.fn(() => ({ toString: () => "id" }));

    const response = await relayWorker.fetch(
      new Request("https://relay.test/ws?serverId=srv_test&role=server&v=nope"),
      { RELAY: { idFromName, get } } as unknown as RelayEnvArg,
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("Invalid v parameter (expected 1 or 2)");
    expect(idFromName).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("pairing landing page + universal-link association", () => {
  // Static routes never touch the RELAY binding.
  const noEnv = {} as unknown as RelayEnvArg;

  it("serves the pairing landing page at the apex", async () => {
    const response = await relayWorker.fetch(
      new Request("https://prism.digitalgriot.studio/"),
      noEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const body = await response.text();
    // The page reads the #offer= fragment and bridges to the prism:// custom scheme.
    expect(body).toContain("#offer=");
    expect(body).toContain("prism://");
  });

  it("serves the pairing landing page at /pair", async () => {
    const response = await relayWorker.fetch(
      new Request("https://prism.digitalgriot.studio/pair"),
      noEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("serves the apple-app-site-association with both bundle ids", async () => {
    const response = await relayWorker.fetch(
      new Request("https://prism.digitalgriot.studio/.well-known/apple-app-site-association"),
      noEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const aasa = (await response.json()) as {
      applinks: { details: Array<{ appIDs: string[] }> };
    };
    const appIDs = aasa.applinks.details[0]?.appIDs ?? [];
    expect(appIDs.some((id) => id.endsWith(".com.thedigitalgriot.prism"))).toBe(true);
    expect(appIDs.some((id) => id.endsWith(".com.thedigitalgriot.prism.debug"))).toBe(true);
    // Every appID must be prefixed with a real 10-char Apple Team ID (never the placeholder).
    expect(appIDs.every((id) => /^[A-Z0-9]{10}\./.test(id))).toBe(true);
    expect(appIDs.every((id) => !id.startsWith("REPLACE_WITH"))).toBe(true);
  });

  it("still routes /relay/ws to the durable object (relay traffic untouched)", async () => {
    const fetch = vi.fn(async () => new Response("relay-ok"));
    const get = vi.fn(() => ({ fetch }));
    const idFromName = vi.fn(() => ({ toString: () => "id" }));

    const response = await relayWorker.fetch(
      new Request("https://prism.digitalgriot.studio/relay/ws?serverId=srv_test&role=server&v=2"),
      { RELAY: { idFromName, get } } as unknown as RelayEnvArg,
    );

    expect(idFromName).toHaveBeenCalledWith("relay-v2:srv_test");
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(response.text()).resolves.toBe("relay-ok");
  });
});
