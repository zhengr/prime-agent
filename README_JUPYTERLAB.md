# Prime Agent JupyterLab Extension / Prime Agent JupyterLab 扩展

> **English is the default language. 中文说明见下方。**

A JupyterLab sidebar chat panel powered by `prime-agent`. References the [jupyter-chat](https://github.com/jupyterlab/jupyter-chat) architecture: `IRenderMimeRegistry` markdown rendering, message bubbles, code-block copy buttons, writing indicator, and scroll container.

基于 `jupyter-chat` 架构的 JupyterLab 侧边栏聊天面板。支持 `IRenderMimeRegistry` Markdown 渲染、消息气泡、代码块复制、打字指示器和自动滚动容器。

---

## What's New / 新增内容

### Jupyter-Chat Pattern Integration (Upgraded from basic HTML)

- **Markdown Rendering** (`IRenderMimeRegistry`): Welcome messages and assistant responses render with syntax highlighting, lists, and LaTeX.
- **Message Bubbles**: User (blue) and assistant (gray) bubbles with rounded corners.
- **Code Toolbar**: Each code block shows language tag + one-click copy button (SVG icon).
- **Writing Indicator**: Animated dots + "Assistant is typing..." when streaming responses.
- **Stop Button**: Red stop button appears during generation; cancels the backend subprocess.
- **Scroll Container**: `MutationObserver` auto-scrolls to the newest message.
- **Theme Variables**: All colors use `--jp-*` CSS variables for native JupyterLab theme compatibility.

---

## Quick Start / 快速开始

```bash
cd prime-agent-jupyterlab
uv pip install -e .
```

Launch with the extension enabled:

```bash
jupyter lab --config=jupyter_server_config.py
```

Access at `http://localhost:8888/lab`. Open the sidebar with `Ctrl/Cmd + Shift + A` and click the **Prime Agent** tab.

---

## Configuration / 配置

```bash
export PRIME_AGENT_BIN=/app/packages/coding-agent/dist/bundle/cli.js
export PRIME_AGENT_CWD=/workspace
export MIXTAO_BASE_URL=http://158.101.23.34:8080/tingly/openai
export MIXTAO_MODEL=mixtao
export MIXTAO_API_KEY=your-key
```

Enable the server extension in `jupyter_server_config.py`:

```python
c.ServerApp.jpserver_extensions = {"prime_agent_jupyterlab": True}
```

---

## WebSocket Protocol / WebSocket 协议

**Client → Server:**
```json
{"type": "prompt", "text": "user message"}
{"type": "stop"}
{"type": "config", "cwd": "/new/path"}
```

**Server → Client:**
```json
{"type": "connected", "sessionId": "...", "agentBin": "..."}
{"type": "event", "kind": "text", "data": {"text": "..."}}
{"type": "done", "exitCode": 0}
{"type": "error", "message": "..."}
```

---

## Architecture / 架构

```
Browser → JupyterLab → Tornado WebSocket (/api/prime-agent/chat/{session})
                              ↓
                        node cli.js --print json -- "prompt"
                              ↓
                        mixtao / OpenAI-compatible API
```

---

## Reference / 参考

- [jupyter-chat](https://github.com/jupyterlab/jupyter-chat) — Component patterns: MessageRenderer, WritingIndicator, ScrollContainer, CodeToolbar.
- [jupyterlab/rendermime](https://github.com/jupyterlab/jupyterlab) — `IRenderMimeRegistry` for markdown/code rendering.
