# Advanced Plugin Example

A complex, enterprise-grade plugin with MCP integration and advanced organization.

## Directory Structure

```
enterprise-devops/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── ci/
│   │   ├── build.md
│   │   ├── test.md
│   │   └── deploy.md
│   ├── monitoring/
│   │   ├── status.md
│   │   └── logs.md
│   └── admin/
│       ├── configure.md
│       └── manage.md
├── agents/
│   ├── orchestration/
│   │   ├── deployment-orchestrator.md
│   │   └── rollback-manager.md
│   └── specialized/
│       ├── kubernetes-expert.md
│       ├── terraform-expert.md
│       └── security-auditor.md
├── skills/
│   ├── kubernetes-ops/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   │   ├── deployment-patterns.md
│   │   │   ├── troubleshooting.md
│   │   │   └── security.md
│   │   ├── examples/
│   │   │   ├── basic-deployment.yaml
│   │   │   ├── stateful-set.yaml
│   │   │   └── ingress-config.yaml
│   │   └── scripts/
│   │       ├── validate-manifest.sh
│   │       └── health-check.sh
│   ├── terraform-iac/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   │   └── best-practices.md
│   │   └── examples/
│   │       └── module-template/
│   └── ci-cd-pipelines/
│       ├── SKILL.md
│       └── references/
│           └── pipeline-patterns.md
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       ├── security/
│       │   ├── scan-secrets.sh
│       │   ├── validate-permissions.sh
│       │   └── audit-changes.sh
│       ├── quality/
│       │   ├── check-config.sh
│       │   └── verify-tests.sh
│       └── workflow/
│           ├── notify-team.sh
│           └── update-status.sh
├── output-styles/
│   └── terse.md              # Concise output formatting
├── .mcp.json
├── .lsp.json                 # LSP server configurations
├── settings.json             # Default settings (activates an agent)
├── servers/
│   ├── kubernetes-mcp/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── lib/
│   ├── terraform-mcp/
│   │   ├── main.py
│   │   └── requirements.txt
│   └── github-actions-mcp/       # Also serves as a channel server
│       ├── server.ts
│       ├── server.js              # Compiled output
│       └── package.json
├── lib/
│   ├── core/
│   │   ├── logger.js
│   │   ├── config.js
│   │   └── auth.js
│   ├── integrations/
│   │   ├── slack.js
│   │   ├── pagerduty.js
│   │   └── datadog.js
│   └── utils/
│       ├── retry.js
│       └── validation.js
└── config/
    ├── environments/
    │   ├── production.json
    │   ├── staging.json
    │   └── development.json
    └── templates/
        ├── deployment.yaml
        └── service.yaml
```

## File Contents

### .claude-plugin/plugin.json

```json
{
  "name": "enterprise-devops",
  "version": "2.3.1",
  "description": "Comprehensive DevOps automation for enterprise CI/CD pipelines, infrastructure management, and monitoring",
  "author": {
    "name": "DevOps Platform Team",
    "email": "devops-platform@company.com",
    "url": "https://company.com/teams/devops"
  },
  "homepage": "https://docs.company.com/plugins/devops",
  "repository": {
    "type": "git",
    "url": "https://github.com/company/devops-plugin.git"
  },
  "license": "Apache-2.0",
  "keywords": [
    "devops",
    "ci-cd",
    "kubernetes",
    "terraform",
    "automation",
    "infrastructure",
    "deployment",
    "monitoring"
  ],
  "commands": [
    "./commands/ci",
    "./commands/monitoring",
    "./commands/admin"
  ],
  "agents": [
    "./agents/orchestration",
    "./agents/specialized"
  ],
  "hooks": "./hooks/hooks.json",
  "mcpServers": "./.mcp.json",
  "lspServers": "./.lsp.json",
  "outputStyles": "./output-styles/",
  "userConfig": {
    "k8s_context": {
      "description": "Kubernetes context name for cluster access",
      "sensitive": false
    },
    "github_token": {
      "description": "GitHub personal access token for CI/CD operations",
      "sensitive": true
    },
    "slack_webhook": {
      "description": "Slack webhook URL for deployment notifications",
      "sensitive": true
    }
  },
  "channels": [
    {
      "server": "github-actions",
      "userConfig": {
        "repo_owner": { "description": "GitHub org or username", "sensitive": false }
      }
    }
  ]
}
```

### .mcp.json

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/kubernetes-mcp/index.js"],
      "env": {
        "KUBECONFIG": "${KUBECONFIG}",
        "K8S_NAMESPACE": "${K8S_NAMESPACE:-default}"
      }
    },
    "terraform": {
      "command": "python",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/terraform-mcp/main.py"],
      "env": {
        "TF_STATE_BUCKET": "${TF_STATE_BUCKET}",
        "AWS_REGION": "${AWS_REGION}"
      }
    },
    "github-actions": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/github-actions-mcp/server.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "GITHUB_ORG": "${GITHUB_ORG}"
      }
    }
  }
}
```

### .lsp.json

```json
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": { ".go": "go" },
    "restartOnCrash": true,
    "maxRestarts": 3
  }
}
```

### settings.json

```json
{
  "agent": "deployment-orchestrator"
}
```

This activates the `deployment-orchestrator` agent as the main thread when the plugin is enabled — applying its system prompt, tool restrictions, and model by default.

### SessionStart hook with ${CLAUDE_PLUGIN_DATA}

The hooks.json includes a SessionStart hook that installs Node.js dependencies on first run and re-installs when the plugin updates with a changed `package.json`:

```json
{
  "SessionStart": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "diff -q \"${CLAUDE_PLUGIN_ROOT}/package.json\" \"${CLAUDE_PLUGIN_DATA}/package.json\" >/dev/null 2>&1 || (cd \"${CLAUDE_PLUGIN_DATA}\" && cp \"${CLAUDE_PLUGIN_ROOT}/package.json\" . && npm install) || rm -f \"${CLAUDE_PLUGIN_DATA}/package.json\""
        }
      ]
    }
  ]
}
```

MCP servers then reference the persisted `node_modules`:

```json
{
  "env": {
    "NODE_PATH": "${CLAUDE_PLUGIN_DATA}/node_modules"
  }
}
```

### commands/ci/build.md

```markdown
---
name: build
description: Trigger and monitor CI build pipeline
---

# Build Command

Trigger CI/CD build pipeline and monitor progress in real-time.

## Process

1. **Validation**: Check prerequisites
   - Verify branch status
   - Check for uncommitted changes
   - Validate configuration files

2. **Trigger**: Start build via MCP server
   \`\`\`javascript
   // Uses github-actions MCP server
   const build = await tools.github_actions_trigger_workflow({
     workflow: 'build.yml',
     ref: currentBranch
   })
   \`\`\`

3. **Monitor**: Track build progress
   - Display real-time logs
   - Show test results as they complete
   - Alert on failures

4. **Report**: Summarize results
   - Build status
   - Test coverage
   - Performance metrics
   - Deploy readiness

## Integration

After successful build:
- Offer to deploy to staging
- Suggest performance optimizations
- Generate deployment checklist
```

### agents/orchestration/deployment-orchestrator.md

```markdown
---
name: deployment-orchestrator
description: Orchestrates complex multi-environment deployments with rollback capabilities and health monitoring
model: opus
effort: high
maxTurns: 15
tools: Bash, Read, Glob, Grep, Write, Edit, Agent
---

# Deployment Orchestrator Agent

Specialized agent for orchestrating complex deployments across multiple environments.

## Capabilities

- Plan and execute multi-stage deployments
- Coordinate service dependencies
- Monitor deployment health
- Execute automated rollbacks
- Manage deployment approvals

## Expertise

- **Deployment strategies**: Blue-green, canary, rolling updates
- **Dependency management**: Service startup ordering, dependency injection
- **Health monitoring**: Service health checks, metric validation
- **Rollback automation**: Automatic rollback on failure detection
- **Approval workflows**: Multi-stage approval processes

## Orchestration Process

1. **Planning Phase**
   - Analyze deployment requirements
   - Identify service dependencies
   - Generate deployment plan
   - Calculate rollback strategy

2. **Validation Phase**
   - Verify environment readiness
   - Check resource availability
   - Validate configurations
   - Run pre-deployment tests

3. **Execution Phase**
   - Deploy services in dependency order
   - Monitor health after each stage
   - Validate metrics and logs
   - Proceed to next stage on success

4. **Verification Phase**
   - Run smoke tests
   - Validate service integration
   - Check performance metrics
   - Confirm deployment success

5. **Rollback Phase** (if needed)
   - Detect failure conditions
   - Execute rollback plan
   - Restore previous state
   - Notify stakeholders

## MCP Integration

Uses multiple MCP servers:
- `kubernetes`: Deploy and manage containers
- `terraform`: Provision infrastructure
- `github-actions`: Trigger deployment pipelines

## Monitoring Integration

Integrates with monitoring tools via lib:
\`\`\`javascript
const { DatadogClient } = require('${CLAUDE_PLUGIN_ROOT}/lib/integrations/datadog')
const metrics = await DatadogClient.getMetrics(service, timeRange)
\`\`\`

## Notification Integration

Sends updates via Slack and PagerDuty:
\`\`\`javascript
const { SlackClient } = require('${CLAUDE_PLUGIN_ROOT}/lib/integrations/slack')
await SlackClient.notify({
  channel: '#deployments',
  message: 'Deployment started',
  metadata: deploymentPlan
})
\`\`\`
```

### skills/kubernetes-ops/SKILL.md

```markdown
---
name: Kubernetes Operations
description: This skill should be used when deploying to Kubernetes, managing K8s resources, troubleshooting cluster issues, configuring ingress/services, scaling deployments, or working with Kubernetes manifests. Provides comprehensive Kubernetes operational knowledge and best practices.
version: 2.0.0
---

# Kubernetes Operations

Comprehensive operational knowledge for managing Kubernetes clusters and workloads.

## Overview

Manage Kubernetes infrastructure effectively through:
- Deployment strategies and patterns
- Resource configuration and optimization
- Troubleshooting and debugging
- Security best practices
- Performance tuning

## Core Concepts

### Resource Management

**Deployments**: Use for stateless applications
- Rolling updates for zero-downtime deployments
- Rollback capabilities for failed deployments
- Replica management for scaling

**StatefulSets**: Use for stateful applications
- Stable network identities
- Persistent storage
- Ordered deployment and scaling

**DaemonSets**: Use for node-level services
- Log collectors
- Monitoring agents
- Network plugins

### Configuration

**ConfigMaps**: Store non-sensitive configuration
- Environment-specific settings
- Application configuration files
- Feature flags

**Secrets**: Store sensitive data
- API keys and tokens
- Database credentials
- TLS certificates

Use external secret management (Vault, AWS Secrets Manager) for production.

### Networking

**Services**: Expose applications internally
- ClusterIP for internal communication
- NodePort for external access (non-production)
- LoadBalancer for external access (production)

**Ingress**: HTTP/HTTPS routing
- Path-based routing
- Host-based routing
- TLS termination
- Load balancing

## Deployment Strategies

### Rolling Update

Default strategy, gradual replacement:
\`\`\`yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
\`\`\`

**When to use**: Standard deployments, minor updates

### Recreate

Stop all pods, then create new ones:
\`\`\`yaml
strategy:
  type: Recreate
\`\`\`

**When to use**: Stateful apps that can't run multiple versions

### Blue-Green

Run two complete environments, switch traffic:
1. Deploy new version (green)
2. Test green environment
3. Switch traffic to green
4. Keep blue for quick rollback

**When to use**: Critical services, need instant rollback

### Canary

Gradually roll out to subset of users:
1. Deploy canary version (10% traffic)
2. Monitor metrics and errors
3. Increase traffic gradually
4. Complete rollout or rollback

**When to use**: High-risk changes, want gradual validation

## Resource Configuration

### Resource Requests and Limits

Always set for production workloads:
\`\`\`yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
\`\`\`

**Requests**: Guaranteed resources
**Limits**: Maximum allowed resources

### Health Checks

Essential for reliability:
\`\`\`yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
\`\`\`

**Liveness**: Restart unhealthy pods
**Readiness**: Remove unready pods from service

## Troubleshooting

### Common Issues

1. **Pods not starting**
   - Check: `kubectl describe pod <name>`
   - Look for: Image pull errors, resource constraints
   - Fix: Verify image name, increase resources

2. **Service not reachable**
   - Check: `kubectl get svc`, `kubectl get endpoints`
   - Look for: No endpoints, wrong selector
   - Fix: Verify pod labels match service selector

3. **High memory usage**
   - Check: `kubectl top pods`
   - Look for: Pods near memory limit
   - Fix: Increase limits, optimize application

4. **Frequent restarts**
   - Check: `kubectl get pods`, `kubectl logs <name>`
   - Look for: Liveness probe failures, OOMKilled
   - Fix: Adjust health checks, increase memory

### Debugging Commands

Get pod details:
\`\`\`bash
kubectl describe pod <name>
kubectl logs <name>
kubectl logs <name> --previous  # logs from crashed container
\`\`\`

Execute commands in pod:
\`\`\`bash
kubectl exec -it <name> -- /bin/sh
kubectl exec <name> -- env
\`\`\`

Check resource usage:
\`\`\`bash
kubectl top nodes
kubectl top pods
\`\`\`

## Security Best Practices

### Pod Security

- Run as non-root user
- Use read-only root filesystem
- Drop unnecessary capabilities
- Use security contexts

Example:
\`\`\`yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
\`\`\`

### Network Policies

Restrict pod communication:
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow
spec:
  podSelector:
    matchLabels:
      app: api
  ingress:
    - from:
      - podSelector:
          matchLabels:
            app: frontend
\`\`\`

### Secrets Management

- Never commit secrets to git
- Use external secret managers
- Rotate secrets regularly
- Limit secret access with RBAC

## Performance Optimization

### Resource Tuning

1. **Start conservative**: Set low limits initially
2. **Monitor usage**: Track actual resource consumption
3. **Adjust gradually**: Increase based on metrics
4. **Set appropriate requests**: Match typical usage
5. **Set safe limits**: 2x requests for headroom

### Horizontal Pod Autoscaling

Automatically scale based on metrics:
\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
\`\`\`

## MCP Server Integration

This skill works with the kubernetes MCP server for operations:

**List pods**:
\`\`\`javascript
const pods = await tools.k8s_list_pods({ namespace: 'default' })
\`\`\`

**Get pod logs**:
\`\`\`javascript
const logs = await tools.k8s_get_logs({ pod: 'api-xyz', container: 'app' })
\`\`\`

**Apply manifests**:
\`\`\`javascript
const result = await tools.k8s_apply_manifest({ file: 'deployment.yaml' })
\`\`\`

## Detailed References

For in-depth information:
- **Deployment patterns**: `references/deployment-patterns.md`
- **Troubleshooting guide**: `references/troubleshooting.md`
- **Security hardening**: `references/security.md`

## Example Manifests

For copy-paste examples:
- **Basic deployment**: `examples/basic-deployment.yaml`
- **StatefulSet**: `examples/stateful-set.yaml`
- **Ingress config**: `examples/ingress-config.yaml`

## Validation Scripts

For manifest validation:
\`\`\`bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/kubernetes-ops/scripts/validate-manifest.sh deployment.yaml
\`\`\`
```

### hooks/hooks.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/security/scan-secrets.sh",
            "timeout": 30
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "INPUT=$(cat); CMD=$(echo \"$INPUT\" | jq -r '.tool_input.command // empty'); case \"$CMD\" in *rm\\ -rf*|*kubectl\\ delete*|*terraform\\ destroy*|*--force*|*drop\\ *) echo '{\"decision\": \"block\", \"reason\": \"Destructive command detected in production context\"}'; exit 1;; esac",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/workflow/update-status.sh",
            "timeout": 15
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/quality/check-config.sh",
            "timeout": 45
          },
          {
            "type": "http",
            "url": "https://hooks.slack.com/services/${user_config.slack_webhook}"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/security/validate-permissions.sh",
            "timeout": 20
          },
          {
            "type": "command",
            "command": "diff -q \"${CLAUDE_PLUGIN_ROOT}/package.json\" \"${CLAUDE_PLUGIN_DATA}/package.json\" >/dev/null 2>&1 || (cd \"${CLAUDE_PLUGIN_DATA}\" && cp \"${CLAUDE_PLUGIN_ROOT}/package.json\" . && npm install) || rm -f \"${CLAUDE_PLUGIN_DATA}/package.json\""
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/workflow/update-status.sh"
          }
        ]
      }
    ],
    "FileChanged": [
      {
        "matcher": "*.yaml",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/quality/check-config.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write",
        "if": "Write(**/deployments/*.yaml)",
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify this Kubernetes deployment manifest is valid: check that referenced ConfigMaps and Secrets exist, resource limits are set, health checks are defined, and image tags are pinned (not :latest). Read related files as needed. $ARGUMENTS",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### servers/github-actions-mcp/server.ts (Channel Server)

This MCP server doubles as a **one-way channel** — it polls the GitHub Actions API for workflow run failures and pushes them into Claude's context as `<channel>` events. The same server also exposes standard MCP tools for triggering workflows.

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG = process.env.GITHUB_ORG;
const POLL_INTERVAL_MS = 30_000;

// Track already-notified runs to avoid duplicates
const notifiedRuns = new Set<number>();

// --- Server setup: one-way channel + tools ---

const server = new McpServer({
  name: "github-actions",
  version: "1.0.0",
}, {
  capabilities: {
    experimental: {
      "claude/channel": {},   // Register as a channel
    },
    tools: {},                // Also expose MCP tools
  },
  instructions:
    "You will receive GitHub Actions build failure notifications. " +
    "When a build fails, summarize the error, identify the likely cause, " +
    "and suggest a fix. Do not take action unless the user asks.",
});

// --- MCP tool: trigger a workflow ---

server.tool(
  "trigger_workflow",
  "Trigger a GitHub Actions workflow",
  {
    repo: z.string().describe("Repository name (without org)"),
    workflow: z.string().describe("Workflow filename (e.g. build.yml)"),
    ref: z.string().default("main").describe("Git ref to run against"),
  },
  async ({ repo, workflow, ref }) => {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_ORG}/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({ ref }),
      }
    );
    if (!res.ok) {
      return { content: [{ type: "text", text: `Failed: ${res.status} ${await res.text()}` }] };
    }
    return { content: [{ type: "text", text: `Triggered ${workflow} on ${repo}@${ref}` }] };
  }
);

// --- Channel: poll for failed workflow runs ---

async function pollFailedRuns() {
  try {
    const res = await fetch(
      `https://api.github.com/orgs/${GITHUB_ORG}/actions/runs?status=failure&per_page=5`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!res.ok) return;

    const data = await res.json();
    for (const run of data.workflow_runs ?? []) {
      if (notifiedRuns.has(run.id)) continue;
      notifiedRuns.add(run.id);

      await server.notification({
        method: "notifications/claude/channel",
        params: {
          content: `Build #${run.run_number} failed on ${run.head_branch} in ${run.repository.name}: ${run.html_url}`,
          meta: {
            severity: "high",
            run_id: String(run.id),
            repo: run.repository.name,
            branch: run.head_branch,
          },
        },
      });
    }
  } catch {
    // Silently retry on next interval
  }
}

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
setInterval(pollFailedRuns, POLL_INTERVAL_MS);
pollFailedRuns(); // initial poll
```

**Key points:**
- The server declares `claude/channel` capability — this makes it a channel
- It also declares `tools` — so Claude can call `trigger_workflow` (making it a hybrid MCP server + one-way channel)
- `instructions` tell Claude how to react to incoming build failure events
- The poll loop uses a `Set` to deduplicate already-notified runs
- Events arrive in Claude's context as `<channel source="github-actions" severity="high" ...>` tags

To upgrade this to a **two-way channel** (e.g., Claude replies to a Slack thread about the failure), add a reply tool:

```typescript
server.tool(
  "reply_to_thread",
  "Post a message to the Slack thread about this CI failure",
  { message: z.string(), channel_id: z.string() },
  async ({ message, channel_id }) => {
    await postToSlack(channel_id, message);
    return { content: [{ type: "text", text: `Posted to ${channel_id}` }] };
  }
);
```

## Key Features

### Multi-Level Organization

**Commands**: Organized by function (CI, monitoring, admin)
**Agents**: Separated by role (orchestration vs. specialized) with full frontmatter (model, effort, maxTurns, tools)
**Skills**: Rich resources (references, examples, scripts)

### MCP Integration

Three custom MCP servers:
- **Kubernetes**: Cluster operations
- **Terraform**: Infrastructure provisioning
- **GitHub Actions**: CI/CD automation (also used as a channel for message injection)

### LSP Integration

Language server for Go code intelligence (gopls) — provides diagnostics, go-to-definition, and hover info.

### User Configuration (userConfig)

Prompts users for required values at enable time:
- `k8s_context`: Kubernetes cluster context (non-sensitive)
- `github_token`: GitHub PAT for CI/CD (sensitive, stored in keychain)
- `slack_webhook`: Slack webhook for notifications (sensitive)

### Channels

The GitHub Actions MCP server doubles as a **one-way channel** — it polls for build failures and pushes `<channel>` events into Claude's context. The server declares `claude/channel` capability in its constructor and uses `server.notification()` to emit events. See `servers/github-actions-mcp/server.ts` above for the full implementation. Per-channel `userConfig` prompts for `repo_owner` at enable time.

**Development testing:** Requires `claude --dangerously-load-development-channels plugin:enterprise-devops@marketplace` until the plugin passes marketplace security review. Team/Enterprise admins can add the plugin to `allowedChannelPlugins` instead.

### Persistent Data (${CLAUDE_PLUGIN_DATA})

SessionStart hook installs Node.js dependencies once and re-installs only when `package.json` changes across plugin updates. Dependencies persist in `${CLAUDE_PLUGIN_DATA}/node_modules`.

### Default Settings

`settings.json` activates the `deployment-orchestrator` agent as the main thread when the plugin is enabled.

### Expanded Hook Events

Uses 7 hook events: `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `SubagentStop`, `FileChanged`, plus a scoped `PreToolUse` with `if` field. Demonstrates all 4 hook types: `command` (deterministic checks), `http` (Slack notifications), `prompt` (none — replaced with command hooks per token efficiency best practices), and `agent` (K8s manifest verification requiring file reads).

### Shared Libraries

Reusable code in `lib/`:
- **Core**: Common utilities (logging, config, auth)
- **Integrations**: External services (Slack, Datadog)
- **Utils**: Helper functions (retry, validation)

### Security Automation

Multiple security hooks:
- Secret scanning before writes (command hook)
- Bash command safety evaluation (prompt hook)
- Permission validation on session start
- YAML config validation on file changes (FileChanged hook)

## Use Cases

1. **Multi-environment deployments**: Orchestrated rollouts across dev/staging/prod
2. **Infrastructure as code**: Terraform automation with state management
3. **CI/CD automation**: Build, test, deploy pipelines
4. **Monitoring and observability**: Integrated metrics and alerting
5. **Security enforcement**: Automated security scanning and validation
6. **Team collaboration**: Slack notifications and status updates

## When to Use This Pattern

- Large-scale enterprise deployments
- Multiple environment management
- Complex CI/CD workflows
- Integrated monitoring requirements
- Security-critical infrastructure
- Team collaboration needs

## Scaling Considerations

- **Performance**: Separate MCP servers for parallel operations
- **Organization**: Multi-level directories for scalability
- **Maintainability**: Shared libraries reduce duplication
- **Flexibility**: Environment configs enable customization
- **Security**: Layered security hooks and validation
