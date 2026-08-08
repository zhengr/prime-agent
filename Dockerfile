# ============================================================================
# Prime Agent — Multi-stage Dockerfile
# Includes: prime-agent CLI + JupyterLab chat panel
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

RUN npm ci --ignore-scripts

# Copy remaining source
COPY . .

# Rebuild native addons (zeromq etc.) and run postinstall scripts
RUN npm rebuild && node packages/coding-agent/postinstall.cjs

# Build all packages (tui → ai → agent → coding-agent, including bundle)
RUN npm run build

# Remove devDependencies and prune native bindings to reduce copy size
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: Runtime (Node.js 22 + Python 3 + JupyterLab)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python runtime deps for prime-agent
RUN pip3 install --break-system-packages --no-cache-dir \
    ipykernel nest-asyncio tyro

# Install JupyterLab + prime-agent extension deps
RUN pip3 install --break-system-packages --no-cache-dir \
    jupyterlab==4.6.* jupyter-server tornado

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

# ---------------------------------------------------------------------------
# Install the JupyterLab chat panel extension
# ---------------------------------------------------------------------------
WORKDIR /app/jupyterlab-ext
COPY jupyterlab-ext/pyproject.toml ./
COPY jupyterlab-ext/prime_agent_jupyterlab/ ./prime_agent_jupyterlab/
COPY jupyterlab-ext/jupyter_server_config.py ./

RUN pip3 install --break-system-packages --no-cache-dir -e .

# JupyterLab config: load the extension
COPY jupyterlab-ext/jupyter_server_config.py /app/jupyter_server_config.py

# Set up working directory for user projects
WORKDIR /workspace

# Labels
LABEL org.opencontainers.image.title="prime-agent"
LABEL org.opencontainers.image.description="Prime Agent with JupyterLab chat panel"
LABEL org.opencontainers.image.source="https://github.com/zhengr/prime-agent"
LABEL org.opencontainers.image.licenses="MIT"

# Default: start JupyterLab with the chat panel extension
EXPOSE 8888
ENTRYPOINT ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--allow-root", "--ServerApp.token=", "--ServerApp.password=", "--config=/app/jupyter_server_config.py"]
CMD []
