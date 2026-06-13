import { describe, it, expect } from "vitest";
import {
  createClientChannel,
  createDaemonChannel,
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encrypt,
  decrypt,
  type Transport,
} from "./index";

/** Two cross-wired in-memory transports (client <-> daemon). */
function makePair(): [Transport, Transport] {
  const a: Transport = { onmessage: null, onclose: null, onerror: null, send: () => {}, close: () => {} };
  const b: Transport = { onmessage: null, onclose: null, onerror: null, send: () => {}, close: () => {} };
  a.send = (d) => queueMicrotask(() => b.onmessage?.(d));
  b.send = (d) => queueMicrotask(() => a.onmessage?.(d));
  a.close = (code = 1000, reason = "") => {
    a.onclose?.(code, reason);
    b.onclose?.(code, reason);
  };
  b.close = (code = 1000, reason = "") => {
    b.onclose?.(code, reason);
    a.onclose?.(code, reason);
  };
  return [a, b];
}

async function waitFor(cond: () => boolean, ms = 1500): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("@prism/relay crypto primitives", () => {
  it("derives a matching shared key on both sides (ECDH) and round-trips ciphertext", () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();
    const aShared = deriveSharedKey(alice.secretKey, importPublicKey(exportPublicKey(bob.publicKey)));
    const bShared = deriveSharedKey(bob.secretKey, importPublicKey(exportPublicKey(alice.publicKey)));

    const ct = encrypt(aShared, "secret payload");
    const pt = decrypt(bShared, ct);
    expect(pt).toBe("secret payload");
  });

  it("fails to decrypt with the wrong key", () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const wrong = generateKeyPair();
    const shared = deriveSharedKey(a.secretKey, b.publicKey);
    const wrongShared = deriveSharedKey(wrong.secretKey, b.publicKey);
    const ct = encrypt(shared, "top secret");
    expect(() => decrypt(wrongShared, ct)).toThrow();
  });
});

describe("@prism/relay encrypted channel handshake", () => {
  it("completes the ECDH handshake and round-trips an encrypted message client->daemon", async () => {
    const daemonKeys = generateKeyPair();
    const daemonPubB64 = exportPublicKey(daemonKeys.publicKey);
    const [clientT, daemonT] = makePair();

    const daemonReceived: string[] = [];
    const daemonChannelP = createDaemonChannel(daemonT, daemonKeys, {
      onmessage: (d) => daemonReceived.push(typeof d === "string" ? d : "(binary)"),
    });

    const clientChannel = await createClientChannel(clientT, daemonPubB64, {});
    await daemonChannelP;

    await clientChannel.send("hello daemon");
    await waitFor(() => daemonReceived.length > 0);
    expect(daemonReceived[0]).toBe("hello daemon");
  });

  it("round-trips daemon->client too", async () => {
    const daemonKeys = generateKeyPair();
    const daemonPubB64 = exportPublicKey(daemonKeys.publicKey);
    const [clientT, daemonT] = makePair();

    const clientReceived: string[] = [];
    const daemonChannelP = createDaemonChannel(daemonT, daemonKeys, {});
    const clientChannel = await createClientChannel(clientT, daemonPubB64, {
      onmessage: (d) => clientReceived.push(typeof d === "string" ? d : "(binary)"),
    });
    const daemonChannel = await daemonChannelP;

    await waitFor(() => clientChannel.isOpen());
    await daemonChannel.send("hello client");
    await waitFor(() => clientReceived.length > 0);
    expect(clientReceived[0]).toBe("hello client");
  });
});
