"""
Prime Agent JupyterLab Extension
================================
Chat panel that interfaces with prime-agent CLI via subprocess.
Pure Python — no TypeScript build required.

Install:
    uv pip install -e .
    jupyter lab --config=jupyter_server_config.py

Or add to jupyter_server_config.py:
    c.ServerApp.jpserver_extensions = {"prime_agent_jupyterlab": True}
"""

import json
import asyncio
import os
from pathlib import Path
from typing import Dict

import tornado.web
import tornado.websocket
from jupyter_server.base.handlers import JupyterHandler

__version__ = "0.1.0"

# ---------------------------------------------------------------------------
# Configuration — resolved at import time from env vars
# ---------------------------------------------------------------------------

def _find_prime_agent_bin() -> str:
    """Locate the prime-agent binary."""
    env_bin = os.environ.get("PRIME_AGENT_BIN")
    if env_bin and os.path.isfile(env_bin):
        return env_bin

    for path_dir in os.environ.get("PATH", "").split(":"):
        candidate = os.path.join(path_dir, "pi")
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate

    workspace = os.environ.get("PRIME_AGENT_CWD", "/workspace")
    for root_dir in [workspace, os.path.expanduser("~"), "/app"]:
        for sub in ["prime-agent", ".prime-agent", ""]:
            bundle = os.path.join(root_dir, sub, "packages/coding-agent/dist/bundle/cli.js")
            if os.path.isfile(bundle):
                return bundle

    return ""


AGENT_BIN = _find_prime_agent_bin()


# ---------------------------------------------------------------------------
# WebSocket Handler — streams prime-agent output
# ---------------------------------------------------------------------------

class PrimeAgentWebSocketHandler(tornado.websocket.WebSocketHandler):
    """WebSocket endpoint: /api/prime-agent/chat/<session_id>

    Protocol (JSON messages):
      Client -> Server:
        {"type": "prompt", "text": "user message"}
        {"type": "stop"}
        {"type": "config", "cwd": "/path/to/workdir"}

      Server -> Client:
        {"type": "connected", "sessionId": "...", "agentBin": "..."}
        {"type": "event", "kind": "...", "data": {...}}
        {"type": "error", "message": "..."}
        {"type": "done", "exitCode": 0}
    """

    _connections: Dict[str, "PrimeAgentWebSocketHandler"] = {}
    _processes: Dict[str, asyncio.subprocess.Process] = {}
    _cws: Dict[str, str] = {}

    def check_origin(self, origin):
        return True

    async def open(self, session_id: str = "default"):
        self.session_id = session_id
        self._connections[session_id] = self

        cwd = self._cws.get(session_id, os.environ.get("PRIME_AGENT_CWD", os.path.expanduser("~/workspace")))

        self.write_message(json.dumps({
            "type": "connected",
            "sessionId": session_id,
            "agentBin": AGENT_BIN,
            "cwd": cwd,
        }))

    async def on_message(self, raw: str):
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            self.write_message(json.dumps({"type": "error", "message": "Invalid JSON"}))
            return

        msg_type = msg.get("type")

        if msg_type == "prompt":
            await self._handle_prompt(msg)
        elif msg_type == "stop":
            await self._handle_stop()
        elif msg_type == "config":
            self._cws[self.session_id] = msg.get("cwd", self._cws.get(self.session_id, "."))

    async def _handle_prompt(self, msg: dict):
        text = msg.get("text", "").strip()
        if not text:
            self.write_message(json.dumps({"type": "error", "message": "Empty prompt"}))
            return

        if not AGENT_BIN:
            self.write_message(json.dumps({
                "type": "error",
                "message": "prime-agent not found. Set PRIME_AGENT_BIN or install prime-agent.",
            }))
            return

        await self._kill_process()

        cwd = self._cws.get(self.session_id, os.environ.get("PRIME_AGENT_CWD", "/workspace"))

        cmd = ["node", AGENT_BIN, "--print", "json", "--", text]

        env = os.environ.copy()
        env["FORCE_COLOR"] = "0"
        env["NO_COLOR"] = "1"

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
                env=env,
            )
            self._processes[self.session_id] = process
            asyncio.create_task(self._stream_output(process))
        except Exception as e:
            self.write_message(json.dumps({
                "type": "error",
                "message": f"Failed to start agent: {e}",
            }))

    async def _stream_output(self, process: asyncio.subprocess):
        try:
            assert process.stdout is not None
            while True:
                line = await asyncio.wait_for(process.stdout.readline(), timeout=600)
                if not line:
                    break
                decoded = line.decode("utf-8", errors="replace").strip()
                if not decoded:
                    continue
                try:
                    event = json.loads(decoded)
                    self.write_message(json.dumps({
                        "type": "event",
                        "kind": event.get("type", "unknown"),
                        "data": event,
                    }))
                except json.JSONDecodeError:
                    self.write_message(json.dumps({
                        "type": "event",
                        "kind": "text",
                        "data": {"text": decoded},
                    }))

            returncode = await process.wait()
            self.write_message(json.dumps({"type": "done", "exitCode": returncode}))
        except asyncio.TimeoutError:
            self.write_message(json.dumps({"type": "error", "message": "Timed out (10 min)"}))
            await self._kill_process()
        except Exception as e:
            self.write_message(json.dumps({"type": "error", "message": str(e)}))
        finally:
            self._processes.pop(self.session_id, None)

    async def _handle_stop(self):
        await self._kill_process()
        self.write_message(json.dumps({"type": "stopped"}))

    async def _kill_process(self):
        proc = self._processes.pop(self.session_id, None)
        if proc and proc.returncode is None:
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=5)
            except (asyncio.TimeoutError, ProcessLookupError):
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass

    async def on_close(self):
        await self._kill_process()
        self._connections.pop(self.session_id, None)


# ---------------------------------------------------------------------------
# Chat page handler
# ---------------------------------------------------------------------------

class PrimeAgentChatHandler(JupyterHandler):
    """GET /prime-agent — serves the chat HTML page."""

    def get(self):
        html_path = Path(__file__).parent / "chat.html"
        if html_path.exists():
            self.set_header("Content-Type", "text/html; charset=utf-8")
            self.write(html_path.read_text(encoding="utf-8"))
        else:
            self.set_status(404)
            self.write("chat.html not found")


# ---------------------------------------------------------------------------
# Config endpoint
# ---------------------------------------------------------------------------

class PrimeAgentConfigHandler(JupyterHandler):
    """GET /api/prime-agent/config"""

    def get(self):
        self.finish(json.dumps({
            "agentBin": AGENT_BIN,
            "available": bool(AGENT_BIN),
            "version": __version__,
            "cwd": os.environ.get("PRIME_AGENT_CWD", "/workspace"),
        }))


# ---------------------------------------------------------------------------
# Extension registration
# ---------------------------------------------------------------------------

def load_jupyter_server_extension(serverapp):
    """Register handlers."""
    base_url = serverapp.web_app.settings.get("base_url", "/")
    handlers = [
        (base_url + r"prime-agent", PrimeAgentChatHandler),
        (base_url + r"api/prime-agent/chat/(.*)", PrimeAgentWebSocketHandler),
        (base_url + r"api/prime-agent/config", PrimeAgentConfigHandler),
    ]
    serverapp.web_app.add_handlers(".*$", handlers)
    serverapp.log.info(
        f"Prime Agent extension loaded (bin={AGENT_BIN or 'NOT FOUND'})"
    )


def _jupyter_server_extension_points():
    return [{"module": "prime_agent_jupyterlab"}]
