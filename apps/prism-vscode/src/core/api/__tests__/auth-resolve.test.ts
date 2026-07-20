/**
 * Unit tests for resolveAnthropicAuth (shared prism-core auth resolver).
 *
 * Verifies the deterministic credential-selection policy: the Claude Code
 * subscription OAuth token (CLAUDE_CODE_OAUTH_TOKEN) is preferred so requests
 * bill against the Max subscription; a stored metered API key is the fallback.
 * (Whether the raw Messages API actually bills the subscription for an OAuth
 * token is an integration/runtime concern verified against a live account, not
 * here — this locks only the selection logic.)
 */
import {
  resolveAnthropicAuth,
  OAUTH_TOKEN_ENV,
  OAUTH_BETA_HEADER,
} from "@prism-core/core/api/auth"

describe("resolveAnthropicAuth", () => {
  test("prefers the subscription OAuth token from env over a metered key", () => {
    const auth = resolveAnthropicAuth("sk-ant-metered", {
      [OAUTH_TOKEN_ENV]: "oauth-abc",
    })
    expect(auth).toEqual({ mode: "subscription", authToken: "oauth-abc" })
  })

  test("trims whitespace and ignores an empty env token", () => {
    const auth = resolveAnthropicAuth("sk-ant-metered", {
      [OAUTH_TOKEN_ENV]: "   ",
    })
    expect(auth).toEqual({ mode: "api-key", apiKey: "sk-ant-metered" })
  })

  test("falls back to the metered API key when no OAuth token is present", () => {
    const auth = resolveAnthropicAuth("sk-ant-metered", {})
    expect(auth).toEqual({ mode: "api-key", apiKey: "sk-ant-metered" })
  })

  test("returns mode 'none' when neither credential is available", () => {
    expect(resolveAnthropicAuth(undefined, {})).toEqual({ mode: "none" })
    expect(resolveAnthropicAuth("   ", {})).toEqual({ mode: "none" })
  })

  test("exposes the oauth beta header constant", () => {
    expect(OAUTH_BETA_HEADER).toBe("oauth-2025-04-20")
  })
})
