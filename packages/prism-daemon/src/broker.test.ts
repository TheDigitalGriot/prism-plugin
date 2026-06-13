import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { Broker } from "./broker";
import { Registry } from "./registry";
import type { BrokerEnvelope, WSHello } from "./protocol";

function open(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    ws.once("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        resolve(JSON.parse(data.toString()) as Record<string, unknown>);
      } catch (err) {
        reject(err as Error);
      }
    });
    ws.once("error", reject);
  });
}

describe("Broker handshake (Phase 1)", () => {
  let broker: Broker | undefined;
  let ws: WebSocket | undefined;

  afterEach(async () => {
    ws?.close();
    ws = undefined;
    await broker?.close();
    broker = undefined;
  });

  it("replies to hello with a welcome carrying the live registry snapshot", async () => {
    broker = new Broker({ registry: new Registry() });
    const port = await broker.listen("127.0.0.1", 0);
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await open(ws);

    const hello: WSHello = { type: "hello", clientId: "test-client", version: "0.0.0", caps: [] };
    ws.send(JSON.stringify(hello));

    const welcome = await nextMessage(ws);
    expect(welcome.type).toBe("welcome");
    expect(typeof welcome.sessionId).toBe("string");
    expect(welcome.services).toEqual([]);
    expect(welcome.brokerVersion).toBe("0.1.0");
  });

  it("returns SERVICE_NOT_FOUND for an unknown service", async () => {
    broker = new Broker({ registry: new Registry() });
    const port = await broker.listen("127.0.0.1", 0);
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await open(ws);

    ws.send(JSON.stringify({ type: "hello", clientId: "t", version: "0", caps: [] } satisfies WSHello));
    await nextMessage(ws); // consume welcome

    const env: BrokerEnvelope = { id: "req-1", service: "ghost", method: "noop", ts: 1 };
    ws.send(JSON.stringify(env));

    const res = await nextMessage(ws);
    expect(res.type).toBe("response");
    expect(res.ok).toBe(false);
    expect((res.error as { code: string }).code).toBe("SERVICE_NOT_FOUND");
  });
});
