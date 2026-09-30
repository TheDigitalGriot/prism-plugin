# Debug Integration Protocol

When quality gates fail, automatically invoke debug investigation before retrying.

## Auto-Debug Flow

On quality gate failure:

1. **Capture** full error output (messages, file:line refs, stack traces)
2. **Spawn 3 debug agents in parallel**:
   - `Task(subagent_type="log-investigator")` — check logs for related errors
   - `Task(subagent_type="state-investigator")` — check app state for anomalies
   - `Task(subagent_type="git-investigator")` — check recent changes that might cause failure
3. **Synthesize** findings into root cause hypothesis and fix approach
4. **Record** in progress.md: error output, investigation findings, root cause, suggested fix, files to examine

## Debug Signal

Include debug context in the retry signal so the next iteration can act on it:

```xml
<spectrum-retry reason="QUALITY_GATE_FAILED">
  <error>npm test failed: 2 tests failing</error>
  <root_cause>Missing mock for AuthService in test setup</root_cause>
  <suggested_fix>Add AuthService mock to test/setup.ts beforeEach</suggested_fix>
  <files>src/auth/auth.service.ts:45, test/auth.test.ts:12</files>
</spectrum-retry>
```
