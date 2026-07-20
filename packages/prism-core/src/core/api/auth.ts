/**
 * Shared auth interface + validation logic for Anthropic API key management.
 *
 * Both VSCode (using SecretStorage) and Electron (using safeStorage) implement
 * the SecretStore interface and delegate to these shared functions.
 */

// ---------------------------------------------------------------------------
// SecretStore interface — platform-agnostic key/value secret storage
// ---------------------------------------------------------------------------

export interface SecretStore {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const API_KEY_SECRET = 'prism.anthropicApiKey'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate that a string looks like an Anthropic API key (starts with sk-ant-). */
export function isValidApiKey(key: string): boolean {
  return key.startsWith('sk-ant-') && key.length > 20
}

// ---------------------------------------------------------------------------
// CRUD helpers — work with any SecretStore implementation
// ---------------------------------------------------------------------------

/** Retrieve the stored Anthropic API key, or undefined if not set. */
export async function getApiKey(store: SecretStore): Promise<string | undefined> {
  return store.get(API_KEY_SECRET)
}

/** Store an Anthropic API key in the given store. */
export async function setApiKey(store: SecretStore, key: string): Promise<void> {
  return store.set(API_KEY_SECRET, key)
}

/** Delete the stored Anthropic API key. */
export async function deleteApiKey(store: SecretStore): Promise<void> {
  return store.delete(API_KEY_SECRET)
}

// ---------------------------------------------------------------------------
// Claude auth resolution — subscription (OAuth) preferred, metered key fallback
// ---------------------------------------------------------------------------

/** Env var carrying a Claude Code subscription OAuth token (`claude setup-token`). */
export const OAUTH_TOKEN_ENV = 'CLAUDE_CODE_OAUTH_TOKEN'

/** Beta header required when authenticating the Messages API with an OAuth token. */
export const OAUTH_BETA_HEADER = 'oauth-2025-04-20'

/** Which credential a request should use. */
export type ResolvedAuth =
  | { mode: 'subscription'; authToken: string }
  | { mode: 'api-key'; apiKey: string }
  | { mode: 'none' }

/**
 * Decide which Claude credential to authenticate with.
 *
 * Prefers the Claude Code subscription OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`,
 * produced by `claude setup-token`) so every Prism surface bills against the Max
 * subscription like the daemon and CLI already do. Falls back to a stored,
 * metered Anthropic API key when no subscription token is present, and reports
 * `none` when neither is available.
 *
 * @param apiKey Metered API key from secret storage (fallback), if any.
 * @param env    Environment to read the OAuth token from (defaults to process.env).
 */
export function resolveAnthropicAuth(
  apiKey?: string,
  env: Record<string, string | undefined> = typeof process !== 'undefined'
    ? process.env
    : {},
): ResolvedAuth {
  const oauth = env[OAUTH_TOKEN_ENV]?.trim()
  if (oauth) return { mode: 'subscription', authToken: oauth }
  const key = apiKey?.trim()
  if (key) return { mode: 'api-key', apiKey: key }
  return { mode: 'none' }
}
