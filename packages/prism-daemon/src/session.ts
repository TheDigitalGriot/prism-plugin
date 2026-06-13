/**
 * Per-client session. Stores the capabilities advertised in WSHello so the wire
 * boundary can ask one question: `session.supports(cap)`. Rehydrated on reconnect.
 */
export class Session {
  readonly sessionId: string;
  readonly clientId: string;
  readonly version: string;
  private readonly caps: Set<string>;
  /** Service ids this session is subscribed to for push messages. */
  readonly subscriptions = new Set<string>();

  constructor(sessionId: string, clientId: string, version: string, caps: string[] = []) {
    this.sessionId = sessionId;
    this.clientId = clientId;
    this.version = version;
    this.caps = new Set(caps);
  }

  supports(cap: string): boolean {
    return this.caps.has(cap);
  }
}
