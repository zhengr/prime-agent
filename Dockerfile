# ============================================================================
# Prime Agent — Multi-stage Dockerfile
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build (Node.js 22 + Python 3 + build tools for native modules)
# ---------------------------------------------------------------------------
FROM node:22-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-dev python3-pip python3-venv \
    build-essential cmake pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only package manifests first for better layer caching
COPY package.json package-lock.json .npmrc ./
COPY packages/agent/package.json        ./packages/agent/
COPY packages/ai/package.json           ./packages/ai/
COPY packages/coding-agent/package.json ./packages/coding-agent/
COPY packages/tui/package.json          ./packages/tui/

RUN npm ci

# Copy remaining source
COPY . .

# Build all packages (tui → ai → agent → coding-agent, including bundle)
RUN npm run build

# Remove devDependencies and prune native bindings to reduce copy size
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: Runtime (slim image with Node.js 22 + Python 3)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages --no-cache-dir \
       ipykernel nest-asyncio tyro

# Copy entire node_modules (needed for externalized deps in bundle)
COPY --from=builder /app/node_modules ./node_modules

# Copy built packages
COPY --from=builder /app/packages/coding-agent/dist ./packages/coding-agent/dist
COPY --from=builder /app/packages/agent/dist        ./packages/agent/dist
COPY --from=builder /app/packages/ai/dist           ./packages/ai/dist
COPY --from=builder /app/packages/tui/dist          ./packages/tui/dist

# Copy package manifests (read at runtime for version/identity)
COPY --from=builder /app/package.json              ./
COPY --from=builder /app/packages/coding-agent/package.json ./packages/coding-agent/
COPY --from=builder /app/packages/agent/package.json        ./packages/agent/
COPY --from=builder /app/packages/ai/package.json           ./packages/ai/
COPY --from=builder /app/packages/tui/package.json          ./packages/tui/

# Copy Python runtime
COPY --from=builder /app/prime-agent-runtime/ ./prime-agent-runtime/

# Set up working directory for user projects
WORKDIR /workspace

# Labels
LABEL org.opencontainers.image.title="prime-agent"
LABEL org.opencontainers.image.description="Prime Agent: A Self-Improving RLM Agent"
LABEL org.opencontainers.image.source="https://github.com/zhengr/prime-agent"
LABEL org.opencontainers.image.licenses="MIT"

ENTRYPOINT ["node", "packages/coding-agent/dist/bundle/cli.js"]
CMD ["--help"]
