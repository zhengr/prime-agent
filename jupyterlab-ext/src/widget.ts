import { Widget } from "@lumino/widgets";
import { IRenderMimeRegistry } from "@jupyterlab/rendermime";

/**
 * Prime Agent chat widget — references jupyter-chat patterns:
 * - IRenderMimeRegistry markdown rendering via Lumino Widget portal
 * - Writing indicator for streaming
 * - Message header with avatar + name + timestamp
 * - Code block toolbar (copy + language label)
 * - Scroll container with MutationObserver auto-scroll
 * - Welcome message rendered with markdown
 * - JupyterLab theme integration via --jp-* CSS variables
 */

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  element?: HTMLElement;
  timestamp: number;
}

export class PrimeAgentWidget extends Widget {
  private _messages!: HTMLDivElement;
  private _scrollContainer!: HTMLDivElement;
  private _input!: HTMLTextAreaElement;
  private _sendBtn!: HTMLButtonElement;
  private _stopBtn!: HTMLButtonElement;
  private _status!: HTMLSpanElement;
  private _statusText!: HTMLSpanElement;
  private _writingIndicator!: HTMLDivElement;
  private _ws: WebSocket | null = null;
  private _sessionId: string;
  private _currentStreamEl: HTMLDivElement | null = null;
  private _currentStreamText: string = "";
  private _rendermime: IRenderMimeRegistry;
  private _history: ChatMessage[] = [];
  private _isStreaming: boolean = false;
  private _shouldScroll: boolean = true;
  private _mutationObserver: MutationObserver | null = null;

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
    icon.textContent = "\u26A1";

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

    // Scroll container with MutationObserver auto-scroll
    this._scrollContainer = document.createElement("div");
    this._scrollContainer.className = "prime-agent-scroll-container";

    this._messages = document.createElement("div");
    this._messages.className = "prime-agent-messages";
    this._scrollContainer.appendChild(this._messages);
    node.appendChild(this._scrollContainer);

    // Setup auto-scroll via MutationObserver (jupyter-chat pattern)
    this._setupAutoScroll();

    // Welcome message (rendered with markdown)
    this._renderWelcomeMessage();

    // Input area
    const inputArea = document.createElement("div");
    inputArea.className = "prime-agent-input-area";

    const inputWrapper = document.createElement("div");
    inputWrapper.className = "prime-agent-input-wrapper";

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

    inputWrapper.appendChild(this._input);

    const btnRow = document.createElement("div");
    btnRow.className = "prime-agent-btn-row";

    this._sendBtn = document.createElement("button");
    this._sendBtn.className = "prime-agent-send-btn";
    this._sendBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg><span>Send</span>';
    this._sendBtn.title = "Send message (Enter)";
    this._sendBtn.addEventListener("click", () => this._sendMessage());

    this._stopBtn = document.createElement("button");
    this._stopBtn.className = "prime-agent-stop-btn";
    this._stopBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg><span>Stop</span>';
    this._stopBtn.title = "Stop generation";
    this._stopBtn.style.display = "none";
    this._stopBtn.addEventListener("click", () => this._stopAgent());

    btnRow.appendChild(this._sendBtn);
    btnRow.appendChild(this._stopBtn);
    inputWrapper.appendChild(btnRow);
    inputArea.appendChild(inputWrapper);

    // Writing indicator (jupyter-chat pattern)
    this._writingIndicator = document.createElement("div");
    this._writingIndicator.className = "prime-agent-writing-indicator";
    this._writingIndicator.style.display = "none";
    this._writingIndicator.innerHTML =
      '<span class="prime-agent-writing-dots"><span></span><span></span><span></span></span><span class="prime-agent-writing-text">Assistant is typing...</span>';
    inputArea.appendChild(this._writingIndicator);

    node.appendChild(inputArea);
  }

  /**
   * Setup auto-scroll using MutationObserver (jupyter-chat pattern).
   * Detects user scroll position and auto-follows new content.
   */
  private _setupAutoScroll(): void {
    // Scroll listener: detect if user is at bottom
    this._scrollContainer.addEventListener("scroll", () => {
      const el = this._scrollContainer;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      this._shouldScroll = atBottom;
    });

    // MutationObserver: auto-scroll when new content arrives
    this._mutationObserver = new MutationObserver(() => {
      if (this._shouldScroll) {
        this._scrollContainer.scrollTop =
          this._scrollContainer.scrollHeight;
      }
    });

    this._mutationObserver.observe(this._messages, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * Render welcome message using IRenderMimeRegistry (jupyter-chat pattern).
   */
  private _renderWelcomeMessage(): void {
    const welcomeContent = [
      "# Prime Agent",
      "",
      "Your AI coding assistant in JupyterLab.",
      "",
      "**Quick start:**",
      "- Type a message and press Enter to send",
      "- Use Shift+Enter for newlines",
      "- Click the stop button to cancel generation",
      "",
      "---",
      "",
      "Ask me anything about your code, notebooks, or data.",
    ].join("\n");

    const welcomeEl = document.createElement("div");
    welcomeEl.className = "prime-agent-welcome";

    try {
      const renderer = this._rendermime.createRenderer("text/markdown");
      const model = this._rendermime.createModel({
        data: { "text/markdown": welcomeContent },
      });
      renderer.renderModel(model).then(() => {
        welcomeEl.appendChild(renderer.node);
      }).catch(() => {
        welcomeEl.textContent = "Prime Agent ready.";
      });
    } catch {
      welcomeEl.textContent = "Prime Agent ready.";
    }

    this._messages.appendChild(welcomeEl);
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
      // Show writing indicator
      this._writingIndicator.style.display = "flex";
    }
    if (data.text) {
      this._currentStreamText += data.text;
      this._renderMarkdownContent(
        this._currentStreamEl,
        this._currentStreamText
      );
    }
  }

  private _finishStream(exitCode: number): void {
    // Hide writing indicator
    this._writingIndicator.style.display = "none";

    if (this._currentStreamEl && this._currentStreamText) {
      this._history.push({
        role: "assistant",
        content: this._currentStreamText,
        element: this._currentStreamEl,
        timestamp: Date.now(),
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
      const header = document.createElement("div");
      header.className = "prime-agent-msg-header";

      const avatar = document.createElement("div");
      avatar.className = "prime-agent-avatar";
      avatar.textContent = "\u26A1";

      const nameEl = document.createElement("span");
      nameEl.className = "prime-agent-msg-name";
      nameEl.textContent = "Prime Agent";

      const timeEl = document.createElement("span");
      timeEl.className = "prime-agent-msg-time";
      timeEl.textContent = this._formatTime(Date.now());

      header.appendChild(avatar);
      header.appendChild(nameEl);
      header.appendChild(timeEl);
      wrapper.appendChild(header);

      const bubble = document.createElement("div");
      bubble.className = "prime-agent-bubble prime-agent-assistant-bubble";
      wrapper.appendChild(bubble);
    }
    return wrapper;
  }

  private _formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (isToday) {
      return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return d.toLocaleString([], {
      day: "numeric",
      month: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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
      renderer
        .renderModel(model)
        .then(() => {
          bubble.appendChild(renderer.node);
        })
        .catch(() => {
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
   * Add copy buttons to code blocks (jupyter-chat code toolbar pattern).
   */
  private _addCopyButtons(wrapper: HTMLDivElement): void {
    const codeBlocks = wrapper.querySelectorAll("pre");
    codeBlocks.forEach((pre) => {
      if (pre.querySelector(".prime-agent-code-toolbar")) return;

      const toolbar = document.createElement("div");
      toolbar.className = "prime-agent-code-toolbar";

      const langLabel = pre.querySelector(".prime-agent-code-lang");
      if (langLabel) {
        const langClone = document.createElement("span");
        langClone.className = "prime-agent-code-lang-label";
        langClone.textContent = langLabel.textContent || "";
        toolbar.appendChild(langClone);
      }

      const copyBtn = document.createElement("button");
      copyBtn.className = "prime-agent-copy-btn";
      copyBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>';
      copyBtn.title = "Copy code";
      copyBtn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        const text = code ? code.textContent || "" : pre.textContent || "";
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied!</span>';
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>';
            copyBtn.classList.remove("copied");
          }, 2000);
        });
      });

      toolbar.appendChild(copyBtn);
      pre.style.position = "relative";
      pre.insertBefore(toolbar, pre.firstChild);
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

    this._history.push({
      role: "user",
      content: text,
      element: userMsg,
      timestamp: Date.now(),
    });

    // Clear input
    this._input.value = "";
    this._input.style.height = "auto";
    this._input.disabled = true;
    this._sendBtn.style.display = "none";
    this._stopBtn.style.display = "";
    this._currentStreamEl = null;
    this._currentStreamText = "";
    this._isStreaming = true;

    // Show writing indicator
    this._writingIndicator.style.display = "flex";

    // Send via WebSocket
    this._ws.send(JSON.stringify({ type: "prompt", data: text }));
  }

  private _stopAgent(): void {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "stop" }));
    }
  }

  dispose(): void {
    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    super.dispose();
  }
}
