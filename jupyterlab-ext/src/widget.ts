import { Widget } from "@lumino/widgets";
import { IRenderMimeRegistry } from "@jupyterlab/rendermime";

/**
 * Prime Agent chat widget — references jupyter-ai patterns:
 * - IRenderMimeRegistry for markdown rendering (code highlighting, LaTeX, lists)
 * - Distinct user/assistant message bubbles
 * - Copy button on code blocks
 * - Auto-growing textarea input
 */

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  element?: HTMLElement;
}

export class PrimeAgentWidget extends Widget {
  private _messages!: HTMLDivElement;
  private _input!: HTMLTextAreaElement;
  private _sendBtn!: HTMLButtonElement;
  private _stopBtn!: HTMLButtonElement;
  private _status!: HTMLSpanElement;
  private _statusText!: HTMLSpanElement;
  private _ws: WebSocket | null = null;
  private _sessionId: string;
  private _currentStreamEl: HTMLDivElement | null = null;
  private _currentStreamText: string = "";
  private _rendermime: IRenderMimeRegistry;
  private _history: ChatMessage[] = [];
  private _isStreaming: boolean = false;

  constructor(rendermime: IRenderMimeRegistry) {
    const node = document.createElement("div");
    node.className = "prime-agent-widget";
    super({ node });

    this._rendermime = rendermime;
    this._sessionId = this._generateSessionId();
    this._buildUI();
    this._connectWebSocket();
  }

  private _generateSessionId(): string {
    return (
      "session-" +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 8)
    );
  }

  private _buildUI(): void {
    const node = this.node;
    node.innerHTML = "";

    // Header
    const header = document.createElement("div");
    header.className = "prime-agent-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "prime-agent-header-title";

    const icon = document.createElement("span");
    icon.className = "prime-agent-icon";
    icon.textContent = "⚡";

    const title = document.createElement("span");
    title.textContent = "Prime Agent";

    titleGroup.appendChild(icon);
    titleGroup.appendChild(title);
    header.appendChild(titleGroup);

    const statusGroup = document.createElement("div");
    statusGroup.className = "prime-agent-header-status";

    this._status = document.createElement("span");
    this._status.className = "prime-agent-status-dot";
    this._status.title = "Disconnected";

    this._statusText = document.createElement("span");
    this._statusText.className = "prime-agent-status-text";
    this._statusText.textContent = "Disconnected";

    statusGroup.appendChild(this._status);
    statusGroup.appendChild(this._statusText);
    header.appendChild(statusGroup);
    node.appendChild(header);

    // Messages area
    this._messages = document.createElement("div");
    this._messages.className = "prime-agent-messages";
    node.appendChild(this._messages);

    // Welcome message
    this._appendSystemMessage(
      "Ready. Type a message to start.\n\nTip: Press Shift+Enter for newline."
    );

    // Input area
    const inputArea = document.createElement("div");
    inputArea.className = "prime-agent-input-area";

    this._input = document.createElement("textarea");
    this._input.className = "prime-agent-input";
    this._input.placeholder = "Ask Prime Agent... (Shift+Enter for newline)";
    this._input.rows = 1;

    // Auto-grow textarea
    this._input.addEventListener("input", () => {
      this._input.style.height = "auto";
      this._input.style.height =
        Math.min(this._input.scrollHeight, 150) + "px";
    });

    this._input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });
    inputArea.appendChild(this._input);

    const btnRow = document.createElement("div");
    btnRow.className = "prime-agent-btn-row";

    this._sendBtn = document.createElement("button");
    this._sendBtn.className = "prime-agent-send-btn";
    this._sendBtn.innerHTML = '<span class="prime-agent-btn-text">Send</span>';
    this._sendBtn.title = "Send message (Enter)";
    this._sendBtn.addEventListener("click", () => this._sendMessage());

    this._stopBtn = document.createElement("button");
    this._stopBtn.className = "prime-agent-stop-btn";
    this._stopBtn.innerHTML =
      '<span class="prime-agent-btn-text">Stop</span>';
    this._stopBtn.title = "Stop generation";
    this._stopBtn.style.display = "none";
    this._stopBtn.addEventListener("click", () => this._stopAgent());

    btnRow.appendChild(this._sendBtn);
    btnRow.appendChild(this._stopBtn);
    inputArea.appendChild(btnRow);

    node.appendChild(inputArea);
  }

  // ─── WebSocket ─────────────────────────────────────────────────────

  private _connectWebSocket(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/prime-agent/chat/${this._sessionId}`;

    this._ws = new WebSocket(wsUrl);

    this._ws.onopen = () => {
      this._status.classList.add("connected");
      this._status.title = "Connected";
      this._statusText.textContent = "Connected";
    };

    this._ws.onclose = () => {
      this._status.classList.remove("connected");
      this._status.classList.add("disconnected");
      this._status.title = "Disconnected";
      this._statusText.textContent = "Disconnected";
      // Auto-reconnect after 3 seconds
      setTimeout(() => this._connectWebSocket(), 3000);
    };

    this._ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this._handleMessage(msg);
    };
  }

  // ─── Message handling ──────────────────────────────────────────────

  private _handleMessage(msg: any): void {
    switch (msg.type) {
      case "event":
        this._appendStream(msg.data);
        break;
      case "done":
        this._finishStream(msg.exitCode);
        break;
    }
  }

  private _appendStream(data: any): void {
    if (!this._currentStreamEl) {
      this._currentStreamEl = this._createMessageEl("assistant");
      this._messages.appendChild(this._currentStreamEl);
    }
    if (data.text) {
      this._currentStreamText += data.text;
      this._renderMarkdownContent(
        this._currentStreamEl,
        this._currentStreamText
      );
      this._messages.scrollTop = this._messages.scrollHeight;
    }
  }

  private _finishStream(exitCode: number): void {
    if (this._currentStreamEl && this._currentStreamText) {
      this._history.push({
        role: "assistant",
        content: this._currentStreamText,
        element: this._currentStreamEl,
      });
      // Add copy buttons to code blocks after streaming is done
      this._addCopyButtons(this._currentStreamEl);
    }
    this._currentStreamEl = null;
    this._currentStreamText = "";
    this._isStreaming = false;
    this._sendBtn.style.display = "";
    this._stopBtn.style.display = "none";
    this._input.disabled = false;
    this._input.focus();
  }

  // ─── Message rendering ─────────────────────────────────────────────

  private _createMessageEl(
    role: "user" | "assistant" | "system"
  ): HTMLDivElement {
    const wrapper = document.createElement("div");
    wrapper.className = `prime-agent-message prime-agent-${role}`;

    if (role === "user") {
      const bubble = document.createElement("div");
      bubble.className = "prime-agent-bubble prime-agent-user-bubble";
      wrapper.appendChild(bubble);
    } else if (role === "assistant") {
      const avatar = document.createElement("div");
      avatar.className = "prime-agent-avatar";
      avatar.textContent = "⚡";

      const bubble = document.createElement("div");
      bubble.className = "prime-agent-bubble prime-agent-assistant-bubble";

      wrapper.appendChild(avatar);
      wrapper.appendChild(bubble);
    }
    return wrapper;
  }

  /**
   * Render markdown content using JupyterLab's IRenderMimeRegistry.
   * Falls back to plain text with basic formatting if rendering fails.
   */
  private _renderMarkdownContent(
    wrapper: HTMLDivElement,
    markdown: string
  ): void {
    const bubble = wrapper.querySelector(
      ".prime-agent-bubble"
    ) as HTMLDivElement | null;
    if (!bubble) return;

    try {
      const renderer = this._rendermime.createRenderer("text/markdown");
      const model = this._rendermime.createModel({
        data: { "text/markdown": markdown },
      });
      bubble.innerHTML = "";
      renderer.renderModel(model).then(() => {
        bubble.appendChild(renderer.node);
      }).catch(() => {
        this._renderPlainText(bubble, markdown);
      });
      return;
    } catch {
      // Fall through to plain text
    }

    this._renderPlainText(bubble, markdown);
  }

  /**
   * Fallback plain text rendering with basic formatting.
   */
  private _renderPlainText(container: HTMLDivElement, text: string): void {
    const parts = text.split(/(```[\s\S]*?```)/g);
    container.innerHTML = "";

    for (const part of parts) {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3);
        const firstNewline = lines.indexOf("\n");
        const lang =
          firstNewline > 0 ? lines.slice(0, firstNewline).trim() : "";
        const code = firstNewline > 0 ? lines.slice(firstNewline + 1) : lines;

        const pre = document.createElement("pre");
        pre.className = "prime-agent-code-block";

        if (lang) {
          const langLabel = document.createElement("span");
          langLabel.className = "prime-agent-code-lang";
          langLabel.textContent = lang;
          pre.appendChild(langLabel);
        }

        const codeEl = document.createElement("code");
        codeEl.textContent = code;
        pre.appendChild(codeEl);
        container.appendChild(pre);
      } else if (part.trim()) {
        const mdDiv = document.createElement("div");
        mdDiv.className = "prime-agent-markdown-text";
        let html = part
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(
            /`([^`]+)`/g,
            '<code class="prime-agent-inline-code">$1</code>'
          )
          .replace(/\n/g, "<br>");
        mdDiv.innerHTML = html;
        container.appendChild(mdDiv);
      }
    }
  }

  /**
   * Add copy buttons to code blocks in a message element.
   */
  private _addCopyButtons(wrapper: HTMLDivElement): void {
    const codeBlocks = wrapper.querySelectorAll("pre");
    codeBlocks.forEach((pre) => {
      if (pre.querySelector(".prime-agent-copy-btn")) return;

      const copyBtn = document.createElement("button");
      copyBtn.className = "prime-agent-copy-btn";
      copyBtn.textContent = "Copy";
      copyBtn.title = "Copy code";
      copyBtn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        const text = code ? code.textContent || "" : pre.textContent || "";
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = "Copied!";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.textContent = "Copy";
            copyBtn.classList.remove("copied");
          }, 2000);
        });
      });
      pre.style.position = "relative";
      pre.appendChild(copyBtn);
    });
  }

  // ─── User interaction ──────────────────────────────────────────────

  private _sendMessage(): void {
    const text = this._input.value.trim();
    if (!text || !this._ws || this._ws.readyState !== WebSocket.OPEN) return;

    // Show user message
    const userMsg = this._createMessageEl("user");
    const userBubble = userMsg.querySelector(
      ".prime-agent-user-bubble"
    ) as HTMLDivElement;
    userBubble.textContent = text;
    this._messages.appendChild(userMsg);

    this._history.push({ role: "user", content: text, element: userMsg });

    // Clear input
    this._input.value = "";
    this._input.style.height = "auto";
    this._input.disabled = true;
    this._sendBtn.style.display = "none";
    this._stopBtn.style.display = "";
    this._currentStreamEl = null;
    this._currentStreamText = "";
    this._isStreaming = true;

    // Send via WebSocket
    this._ws.send(JSON.stringify({ type: "prompt", data: text }));
    this._messages.scrollTop = this._messages.scrollHeight;
  }

  private _stopAgent(): void {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "stop" }));
    }
  }

  private _appendSystemMessage(text: string): void {
    const msg = document.createElement("div");
    msg.className = "prime-agent-message prime-agent-system";
    const bubble = document.createElement("div");
    bubble.className = "prime-agent-bubble prime-agent-system-bubble";
    bubble.textContent = text;
    msg.appendChild(bubble);
    this._messages.appendChild(msg);
  }

  dispose(): void {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    super.dispose();
  }
}
