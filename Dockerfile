# ============================================================================
# Prime Agent — Multi-stage Dockerfile
# Includes: prime-agent CLI + JupyterLab chat sidebar panel
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build prime-agent (Node.js 22 + Python 3)
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

# Build all packages (tui -> ai -> agent -> coding-agent, including bundle)
RUN npm run build

# Build JupyterLab frontend extension (TypeScript)
# Need JupyterLab installed for @jupyterlab/builder core path
RUN pip3 install --break-system-packages --no-cache-dir \
    jupyterlab==4.6.* hatchling hatch-jupyter-builder

WORKDIR /app/jupyterlab-ext
COPY jupyterlab-ext/package.json jupyterlab-ext/package-lock.json ./
RUN npm ci
COPY jupyterlab-ext/tsconfig.json ./
COPY jupyterlab-ext/src ./src
COPY jupyterlab-ext/style ./style
RUN npx tsc -b

# Build the labextension bundle with @jupyterlab/builder
COPY jupyterlab-ext/install.json ./
COPY jupyterlab-ext/prime_agent_jupyterlab/__init__.py ./prime_agent_jupyterlab/__init__.py
COPY jupyterlab-ext/prime_agent_jupyterlab/labextension/package.json ./prime_agent_jupyterlab/labextension/
RUN JUPYTERLAB_STAGING=$(python3 -c "import jupyterlab; print(jupyterlab.__path__[0] + '/staging')") && \
    npx @jupyterlab/builder --core-path "$JUPYTERLAB_STAGING" .
WORKDIR /app

# Remove devDependencies and prune native bindings
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: Runtime (Node.js 22-slim + Python 3 + JupyterLab)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python runtime deps
RUN pip3 install --break-system-packages --no-cache-dir \
    ipykernel nest-asyncio tyro

# Install JupyterLab + builder (needed for labextension install)
RUN pip3 install --break-system-packages --no-cache-dir \
    jupyterlab==4.6.* jupyter-server tornado hatchling hatch-jupyter-builder

# Copy node_modules (needed for externalized deps in CLI bundle)
COPY --from=builder /app/node_modules ./node_modules

# Copy built prime-agent packages
COPY --from=builder /app/packages/coding-agent/dist ./packages/coding-agent/dist
COPY --from=builder /app/packages/agent/dist        ./packages/agent/dist
COPY --from=builder /app/packages/ai/dist           ./packages/ai/dist
COPY --from=builder /app/packages/tui/dist          ./packages/tui/dist

COPY --from=builder /app/package.json              ./
COPY --from=builder /app/packages/coding-agent/package.json ./packages/coding-agent/
COPY --from=builder /app/packages/agent/package.json        ./packages/agent/
COPY --from=builder /app/packages/ai/package.json           ./packages/ai/
COPY --from=builder /app/packages/tui/package.json          ./packages/tui/

COPY --from=builder /app/prime-agent-runtime/ ./prime-agent-runtime/

# Install the JupyterLab sidebar extension
WORKDIR /app/jupyterlab-ext
COPY jupyterlab-ext/pyproject.toml ./
COPY jupyterlab-ext/install.json ./
COPY jupyterlab-ext/package.json jupyterlab-ext/package-lock.json ./
COPY jupyterlab-ext/tsconfig.json ./
COPY jupyterlab-ext/src ./src
COPY jupyterlab-ext/style ./style
COPY jupyterlab-ext/jupyter_server_config.py ./
COPY jupyterlab-ext/prime_agent_jupyterlab/__init__.py ./prime_agent_jupyterlab/__init__.py
COPY jupyterlab-ext/prime_agent_jupyterlab/labextension/package.json ./prime_agent_jupyterlab/labextension/
COPY --from=builder /app/jupyterlab-ext/node_modules ./node_modules

# Build TypeScript + labextension in runtime stage
RUN npx tsc -b && \
    JUPYTERLAB_STAGING=$(python3 -c "import jupyterlab; print(jupyterlab.__path__[0] + '/staging')") && \
    npx @jupyterlab/builder --core-path "$JUPYTERLAB_STAGING" . && \
    pip3 install --break-system-packages --no-cache-dir -e .

# Copy config
COPY jupyterlab-ext/jupyter_server_config.py /app/jupyter_server_config.py

WORKDIR /workspace

LABEL org.opencontainers.image.title="prime-agent"
LABEL org.opencontainers.image.description="Prime Agent with JupyterLab sidebar chat panel"
LABEL org.opencontainers.image.source="https://github.com/zhengr/prime-agent"
LABEL org.opencontainers.image.licenses="MIT"

EXPOSE 8888
ENTRYPOINT ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--allow-root", "--ServerApp.token=", "--ServerApp.password=", "--config=/app/jupyter_server_config.py"]
CMD []
