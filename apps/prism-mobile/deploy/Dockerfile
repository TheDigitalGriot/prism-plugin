# Griot always-on agent daemon — first-pass container (v1, expect to iterate on native deps)
# Build context MUST be apps/prism-mobile (the daemon monorepo root).
#   docker build -f deploy/Dockerfile -t griot-daemon .
FROM node:22-bookworm

# git: agents do git ops on the workspace checkouts.
# python3/make/g++: node-gyp for native modules (node-pty terminals, better-sqlite3, etc.).
RUN apt-get update \
 && apt-get install -y --no-install-recommends git python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Claude CLI — the Claude provider reads ~/.claude credentials (mounted at runtime).
# Installed best-effort; the Agent SDK (a workspace dep) is the primary path.
RUN npm install -g @anthropic-ai/claude-code || true

WORKDIR /app
# legacy-peer-deps: documented zod3/zod4 conflict (@anthropic-ai/claude-agent-sdk).
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

# Copy the whole prism-mobile monorepo, then install + build the daemon chain.
COPY . .
# "prepare": "lefthook install --force" needs a .git dir — nonexistent in the image; drop it
# (container-only edit; keeps the real postinstall patches + native-module builds intact).
RUN npm pkg delete scripts.prepare
RUN npm install --legacy-peer-deps
# build:daemon = highlight -> relay -> server -> cli (tsc); relay/highlight ship only dist/.
RUN npm run build:daemon

WORKDIR /app/packages/server

# --- Runtime config (override in Coolify env as needed) ---
ENV PASEO_NODE_ENV=production \
    PASEO_LISTEN=0.0.0.0:6767 \
    PASEO_HOME=/data \
    PASEO_SOURCE_CHECKOUT_PATH=/workspace \
    PASEO_RELAY_ENABLED=true \
    PASEO_RELAY_ENDPOINT=prism.digitalgriot.studio:443/relay \
    PASEO_LOG_FORMAT=json \
    PASEO_LOG_LEVEL=info

# The daemon dials OUT to the relay, so a public port isn't strictly required.
# Exposed for LAN/health-check use and direct connections if you choose to route a subdomain.
EXPOSE 6767

# supervisor-entrypoint manages the daemon worker (pid lock, PASEO_HOME, persisted config).
CMD ["node", "dist/scripts/supervisor-entrypoint.js"]
