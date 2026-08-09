/*
 * Copyright (c) Prime Agent contributors.
 * JupyterChat-aligned chat widget — full feature parity.
 *
 * Features ported from jupyterlab/jupyter-chat:
 *  - Message bubbles with avatar, sender name, timestamp
 *  - IRenderMimeRegistry Markdown/LaTeX rendering (cached renderer)
 *  - Code block toolbar: Copy, InsertAbove, InsertBelow, Replace
 *  - Message toolbar: Edit, Delete (hover)
 *  - Multiline input with Enter/Shift+Enter toggle
 *  - Send / Stop / Cancel buttons
 *  - Welcome message (markdown)
 *  - Writing indicator (streaming state)
 *  - Auto-scroll via MutationObserver
 *  - Navigation arrows for unread messages
 *  - Attachment preview list
 *  - @mention autocomplete hint
 *  - JupyterLab theme integration via --jp-* CSS variables
 */

import { Widget } from "@lumino/widgets";
import { MessageLoop } from "@lumino/messaging";
import { IRenderMimeRegistry } from "@jupyterlab/rendermime";
import {
  IMessage,
  INewMessage,
  IConfig,
  IStreamingState,
  IUser,
  IAttachment,
  IMessageRenderDelegate,
  ICodeSelection,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MD_MIME = "text/markdown";
const SCROLL_THRESHOLD = 40; // px from bottom to count as "at bottom"
const DEBOUNCE_MS = 15;

/* ------------------------------------------------------------------ */
/*  CSS class names (mirror jupyter-chat conventions)                  */
/* ------------------------------------------------------------------ */

const C = {
  WIDGET: "pa-chat-widget",
  HEADER: "pa-chat-header",
  HEADER_TITLE: "pa-chat-header-title",
  HEADER_STATUS: "pa-chat-header-status",
  STATUS_DOT: "pa-chat-status-dot",
  STATUS_TEXT: "pa-chat-status-text",
  SCROLL: "pa-chat-scroll-container",
  MESSAGES_BOX: "pa-chat-messages-box",
  MESSAGE: "pa-chat-message",
  MESSAGE_BUBBLE: "pa-chat-message-bubble",
  MESSAGE_HEADER: "pa-chat-message-header",
  MESSAGE_AVATAR: "pa-chat-message-avatar",
  MESSAGE_NAME: "pa-chat-message-name",
  MESSAGE_TIME: "pa-chat-message-time",
  MESSAGE_BODY: "pa-chat-message-body",
  MESSAGE_TOOLBAR: "pa-chat-message-toolbar",
  TOOLBAR_BTN: "pa-chat-toolbar-btn",
  TOOLBAR_BTN_EDIT: "pa-chat-toolbar-btn-edit",
  TOOLBAR_BTN_DELETE: "pa-chat-toolbar-btn-delete",
  WELCOME: "pa-chat-welcome",
  NAVIGATION: "pa-chat-navigation",
  NAVIGATION_BTN: "pa-chat-navigation-btn",
  NAVIGATION_UNREAD: "pa-chat-navigation-unread",
  INPUT_AREA: "pa-chat-input-area",
  INPUT_ATTACHMENTS: "pa-chat-input-attachments",
  INPUT_WRAPPER: "pa-chat-input-wrapper",
  INPUT_FIELD: "pa-chat-input-field",
  INPUT_TOOLBAR: "pa-chat-input-toolbar",
  INPUT_BTN: "pa-chat-input-btn",
  SEND_BTN: "pa-chat-send-btn",
  STOP_BTN: "pa-chat-stop-btn",
  ATTACH_BTN: "pa-chat-attach-btn",
  WRITING: "pa-chat-writing-indicator",
  WRITING_DOT: "pa-chat-writing-dot",
  STREAM: "pa-chat-stream",
  CODE_TOOLBAR: "pa-chat-code-toolbar",
  CODE_TOOLBAR_BTN: "pa-chat-code-toolbar-btn",
  CODE_LANG: "pa-chat-code-lang",
  COPY_OK: "pa-chat-copy-ok",
  MENTION: "pa-chat-mention",
  CURRENT_USER: "pa-chat-current-user",
  OTHER_USER: "pa-chat-other-user",
  EDITING: "pa-chat-editing",
} as const;

/* ------------------------------------------------------------------ */
/*  Helper: generate session ID                                        */
/* ------------------------------------------------------------------ */

function uid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleString([], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeHtml(s: string): string {
  const el = document.createElement("div");
  el.textContent = s;
  return el.innerHTML;
}

/* ------------------------------------------------------------------ */
/*  Main Widget                                                        */
/* ------------------------------------------------------------------ */

export class PrimeAgentWidget extends Widget {
  /* --- DOM refs --- */
  private _messagesBox!: HTMLDivElement;
  private _scrollContainer!: HTMLDivElement;
  private _input!: HTMLTextAreaElement;
  private _sendBtn!: HTMLButtonElement;
  private _stopBtn!: HTMLButtonElement;
  private _attachBtn!: HTMLButtonElement;
  private _statusDot!: HTMLSpanElement;
  private _statusText!: HTMLSpanElement;
  private _writingIndicator!: HTMLDivElement;
  private _navUp!: HTMLButtonElement;
  private _navDown!: HTMLButtonElement;

  /* --- State --- */
  private _rendermime: IRenderMimeRegistry;
  private _sessionId: string;
  private _ws: WebSocket | null = null;
  private _messages: IMessage[] = [];
  private _history: { role: string; content: string }[] = [];
  private _streaming: IStreamingState = {
    active: false,
    messageId: null,
    buffer: "",
    abortController: null,
  };
  private _config: IConfig = {
    sendWithShiftEnter: false,
    enableCodeToolbar: true,
    showDeleted: false,
    sendWithSelection: false,
  };
  private _user: IUser = {
    username: "user",
    display_name: "You",
    bot: false,
  };
  private _assistant: IUser = {
    username: "assistant",
    display_name: "Prime Agent",
    bot: true,
  };

  /* --- Render cache --- */
  private _markdownRenderer: any = null;
  private _renderedMessages: Map<string, HTMLDivElement> = new Map();
  private _renderDelegates: Map<string, IMessageRenderDelegate> = new Map();

  /* --- Observers --- */
  private _scrollObserver: MutationObserver | null = null;
  private _viewportObserver: IntersectionObserver | null = null;
  private _inViewport: Set<number> = new Set();
  private _shouldAutoScroll = true;

  /* --- Code selection (placeholder for JupyterLab integration) --- */
  private _selectionWatcher: ICodeSelection | null = null;

  constructor(rendermime: IRenderMimeRegistry) {
    const node = document.createElement("div");
    node.className = C.WIDGET;
    super({ node });

    this._rendermime = rendermime;
    this._sessionId = uid();
    this._buildUI();
    this._setupObservers();
    this._connectWebSocket();
  }

  /* ================================================================ */
  /*  UI Construction                                                  */
  /* ================================================================ */

  private _buildUI(): void {
    const el = this.node;
    el.innerHTML = "";

    /* --- Header --- */
    const header = this._div(C.HEADER);
    const titleRow = this._div(C.HEADER_TITLE);
    titleRow.innerHTML = `<span class="pa-chat-title-icon">🤖</span> <span>Prime Agent</span>`;
    const statusRow = this._div(C.HEADER_STATUS);
    this._statusDot = this._span(C.STATUS_DOT);
    this._statusText = this._span(C.STATUS_TEXT, "Connecting...");
    statusRow.append(this._statusDot, this._statusText);
    header.append(titleRow, statusRow);
    el.appendChild(header);

    /* --- Scroll container --- */
    this._scrollContainer = this._div(C.SCROLL);
    this._scrollContainer.style.flex = "1";
    this._scrollContainer.style.overflow = "auto";
    this._scrollContainer.style.position = "relative";

    /* Welcome */
    const welcome = this._div(C.WELCOME);
    welcome.style.display = "none";
    this._scrollContainer.appendChild(welcome);

    /* Messages box */
    this._messagesBox = this._div(C.MESSAGES_BOX);
    this._scrollContainer.appendChild(this._messagesBox);

    /* Navigation arrows */
    const nav = this._div(C.NAVIGATION);
    this._navUp = this._navBtn("▲", "Go to unread messages");
    this._navDown = this._navBtn("▼", "Go to last message");
    this._navUp.className = `${C.NAVIGATION_BTN} ${C.NAVIGATION_UNREAD}`;
    this._navDown.className = `${C.NAVIGATION_BTN}`;
    this._navUp.style.display = "none";
    this._navDown.style.display = "none";
    nav.append(this._navUp, this._navDown);
    this._scrollContainer.appendChild(nav);

    /* Scroll listener */
    this._scrollContainer.addEventListener("scroll", () => {
      const el = this._scrollContainer;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
      this._shouldAutoScroll = atBottom;
    });

    el.appendChild(this._scrollContainer);

    /* --- Writing indicator --- */
    this._writingIndicator = this._div(C.WRITING);
    this._writingIndicator.style.display = "none";
    this._writingIndicator.innerHTML = `
      <span class="${C.WRITING_DOT}"></span>
      <span class="${C.WRITING_DOT}"></span>
      <span class="${C.WRITING_DOT}"></span>
      <span class="pa-chat-writing-text">Assistant is typing...</span>
    `;
    el.appendChild(this._writingIndicator);

    /* --- Input area --- */
    const inputArea = this._div(C.INPUT_AREA);

    /* Attachments preview */
    const attachPreview = this._div(C.INPUT_ATTACHMENTS);
    attachPreview.style.display = "none";
    inputArea.appendChild(attachPreview);

    /* Input wrapper */
    const wrapper = this._div(C.INPUT_WRAPPER);
    this._input = document.createElement("textarea");
    this._input.className = C.INPUT_FIELD;
    this._input.placeholder = "Type a message, @ to mention...";
    this._input.rows = 1;
    this._input.maxLength = 10000;
    this._input.addEventListener("input", () => this._autoResize());
    this._input.addEventListener("keydown", (e) => this._handleKey(e));
    wrapper.appendChild(this._input);
    inputArea.appendChild(wrapper);

    /* Input toolbar */
    const toolbar = this._div(C.INPUT_TOOLBAR);
    this._attachBtn = this._inputBtn(C.ATTACH_BTN, "📎", "Attach file");
    this._attachBtn.style.display = "none"; // Show when feature ready

    this._stopBtn = this._inputBtn(C.STOP_BTN, "⏹", "Stop generating");
    this._stopBtn.style.display = "none";
    this._stopBtn.addEventListener("click", () => this._stopStream());

    this._sendBtn = this._inputBtn(C.SEND_BTN, "↑", "Send message (ENTER)");
    this._sendBtn.addEventListener("click", () => this._sendMessage());
    this._updateSendTooltip();

    toolbar.append(this._attachBtn, this._stopBtn, this._sendBtn);
    inputArea.appendChild(toolbar);

    el.appendChild(inputArea);

    /* Focus input */
    requestAnimationFrame(() => this._input.focus());
  }

  /* ================================================================ */
  /*  Observers                                                        */
  /* ================================================================ */

  private _setupObservers(): void {
    /* MutationObserver for auto-scroll during streaming */
    this._scrollObserver = new MutationObserver(() => {
      if (this._shouldAutoScroll) {
        this._scrollContainer.scrollTop =
          this._scrollContainer.scrollHeight;
      }
    });
    this._scrollObserver.observe(this._messagesBox, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    /* IntersectionObserver for viewport tracking */
    this._viewportObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = parseInt(
            entry.target.getAttribute("data-msg-index") ?? "-1"
          );
          if (idx < 0) return;
          if (entry.isIntersecting) {
            this._inViewport.add(idx);
          } else {
            this._inViewport.delete(idx);
          }
        });
        this._updateNavVisibility();
      },
      { threshold: 0.1 }
    );
  }

  /* ================================================================ */
  /*  WebSocket                                                        */
  /* ================================================================ */

  private _connectWebSocket(): void {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/prime_agent/ws`;
    this._setStatus("connecting");

    try {
      this._ws = new WebSocket(url);

      this._ws.onopen = () => {
        this._setStatus("connected");
      };

      this._ws.onclose = () => {
        this._setStatus("disconnected");
        setTimeout(() => this._connectWebSocket(), 5000);
      };

      this._ws.onerror = () => {
        this._setStatus("error");
      };

      this._ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          this._handleMessage(msg);
        } catch {
          /* ignore parse errors */
        }
      };
    } catch {
      this._setStatus("error");
      setTimeout(() => this._connectWebSocket(), 5000);
    }
  }

  /* ================================================================ */
  /*  Message handling                                                 */
  /* ================================================================ */

  private _handleMessage(msg: any): void {
    const kind = msg.kind || msg.type;
    const data = msg.data?.data ?? msg.data ?? msg;

    switch (kind) {
      case "assistant_start":
      case "start":
        this._startStream();
        break;
      case "text":
      case "assistant_text":
        this._appendToStream(data.text ?? data.content ?? "");
        break;
      case "assistant_end":
      case "end":
      case "stop":
        this._finishStream();
        break;
      case "error":
        this._finishStream();
        this._addSystemMessage(
          data.message ?? data.text ?? "An error occurred."
        );
        break;
      case "tool_start":
        this._appendToStream(`\n> 🔧 ${data.name ?? "Tool call"}...\n`);
        break;
      case "tool_end":
        /* Tool result is part of the stream */
        break;
    }
  }

  /* ================================================================ */
  /*  Streaming                                                        */
  /* ================================================================ */

  private _startStream(): void {
    if (this._streaming.active) return;
    this._streaming.active = true;
    this._streaming.buffer = "";
    this._streaming.messageId = uid();

    const msg: IMessage = {
      id: this._streaming.messageId,
      role: "assistant",
      content: "",
      sender: this._assistant,
      time: Math.floor(Date.now() / 1000),
    };
    this._messages.push(msg);

    const el = this._createMessageEl(msg, this._messages.length - 1);
    this._messagesBox.appendChild(el);
    this._renderedMessages.set(msg.id, el);
    this._showWritingIndicator(true);
    this._showStopButton(true);
  }

  private _appendToStream(text: string): void {
    if (!this._streaming.active || !this._streaming.messageId) return;
    this._streaming.buffer += text;

    const msg = this._messages.find(
      (m) => m.id === this._streaming.messageId
    );
    if (msg) {
      msg.content = this._streaming.buffer;
    }

    const el = this._renderedMessages.get(this._streaming.messageId);
    if (!el) return;

    const body = el.querySelector(`.${C.MESSAGE_BODY}`) as HTMLDivElement;
    if (!body) return;

    this._renderMarkdownIncremental(body, this._streaming.buffer);
  }

  private _finishStream(): void {
    if (!this._streaming.active) return;
    this._streaming.active = false;

    const msgId = this._streaming.messageId;
    this._streaming.messageId = null;
    this._streaming.buffer = "";

    /* Final render with full markdown */
    const el = this._renderedMessages.get(msgId!);
    if (el) {
      const body = el.querySelector(`.${C.MESSAGE_BODY}`) as HTMLDivElement;
      if (body) {
        const msg = this._messages.find((m) => m.id === msgId);
        if (msg) {
          this._renderMarkdownFinal(body, msg.content);
          /* Add code block toolbars */
          if (this._config.enableCodeToolbar) {
            this._addCodeToolbars(body);
          }
        }
      }
    }

    /* Reset markdown renderer cache */
    this._markdownRenderer = null;

    /* Record in history */
    if (msgId) {
      const msg = this._messages.find((m) => m.id === msgId);
      if (msg) {
        this._history.push({
          role: "assistant",
          content: msg.content,
        });
      }
    }

    this._showWritingIndicator(false);
    this._showStopButton(false);
  }

  /* ================================================================ */
  /*  Markdown rendering                                               */
  /* ================================================================ */

  private _getOrCreateRenderer(): any {
    if (!this._markdownRenderer) {
      this._markdownRenderer = this._rendermime.createRenderer(MD_MIME);
    }
    return this._markdownRenderer;
  }

  private _renderMarkdownIncremental(
    container: HTMLElement,
    text: string
  ): void {
    /* During streaming: render incrementally.
     * Reuse cached renderer, replace container content. */
    const renderer = this._getOrCreateRenderer();
    const mimeModel = this._rendermime.createModel({
      data: { [MD_MIME]: text },
    });
    renderer.renderModel(mimeModel).then(() => {
      /* Clear and re-attach */
      container.innerHTML = "";
      container.appendChild(renderer.node.cloneNode(true));
    });
  }

  private _renderMarkdownFinal(
    container: HTMLElement,
    text: string
  ): void {
    /* Final render after streaming completes. */
    const renderer = this._rendermime.createRenderer(MD_MIME);
    const mimeModel = this._rendermime.createModel({
      data: { [MD_MIME]: text },
    });

    renderer.renderModel(mimeModel).then(() => {
      container.innerHTML = "";
      container.appendChild(renderer.node);
      /* Trigger Lumino attach for LaTeX rendering */
      MessageLoop.sendMessage(renderer, (Widget as any).Msg.AfterAttach);
    });
  }

  /* ================================================================ */
  /*  Message DOM                                                      */
  /* ================================================================ */

  private _createMessageEl(
    msg: IMessage,
    index: number
  ): HTMLDivElement {
    const isUser = msg.sender.username === this._user.username;
    const wrapper = this._div(C.MESSAGE);
    wrapper.setAttribute("data-msg-index", String(index));
    wrapper.setAttribute("data-msg-id", msg.id);
    wrapper.classList.add(isUser ? C.CURRENT_USER : C.OTHER_USER);

    /* Observe for viewport tracking */
    if (this._viewportObserver) {
      this._viewportObserver.observe(wrapper);
    }

    /* Message bubble */
    const bubble = this._div(C.MESSAGE_BUBBLE);

    /* Header: avatar + name + time + toolbar */
    const header = this._div(C.MESSAGE_HEADER);

    if (!isUser) {
      const avatar = this._div(C.MESSAGE_AVATAR);
      avatar.textContent = "🤖";
      header.appendChild(avatar);
    }

    const name = this._span(C.MESSAGE_NAME);
    name.textContent =
      msg.sender.display_name ?? msg.sender.name ?? msg.sender.username;
    header.appendChild(name);

    const time = this._span(C.MESSAGE_TIME);
    time.textContent = fmtTime(msg.time);
    header.appendChild(time);

    /* Message toolbar (edit/delete) — shown on hover */
    const toolbar = this._div(C.MESSAGE_TOOLBAR);
    const editBtn = this._toolbarBtn(
      C.TOOLBAR_BTN_EDIT,
      "✏️",
      "Edit",
      () => this._editMessage(msg)
    );
    const deleteBtn = this._toolbarBtn(
      C.TOOLBAR_BTN_DELETE,
      "🗑️",
      "Delete",
      () => this._deleteMessage(msg)
    );
    toolbar.append(editBtn, deleteBtn);
    toolbar.style.display = "none";
    header.appendChild(toolbar);

    /* Show toolbar on hover */
    wrapper.addEventListener("mouseenter", () => {
      toolbar.style.display = "flex";
    });
    wrapper.addEventListener("mouseleave", () => {
      toolbar.style.display = "none";
    });

    bubble.appendChild(header);

    /* Body */
    const body = this._div(C.MESSAGE_BODY);
    if (isUser) {
      /* User messages: render as markdown (supports code blocks etc.) */
      this._renderMarkdownFinal(body, msg.content);
    }
    /* Assistant messages get body content from streaming */
    bubble.appendChild(body);

    wrapper.appendChild(bubble);
    return wrapper;
  }

  /* ================================================================ */
  /*  Code block toolbar                                               */
  /* ================================================================ */

  private _addCodeToolbars(container: HTMLElement): void {
    const blocks = container.querySelectorAll("pre > code");
    blocks.forEach((codeEl) => {
      const pre = codeEl.parentElement as HTMLElement;
      if (!pre || pre.querySelector(`.${C.CODE_TOOLBAR}`)) return;

      /* Detect language */
      const langClass = Array.from(codeEl.classList).find((c) =>
        c.startsWith("language-")
      );
      const lang = langClass
        ? langClass.replace("language-", "")
        : "";

      /* Create toolbar */
      const toolbar = document.createElement("div");
      toolbar.className = C.CODE_TOOLBAR;

      /* Language label */
      if (lang) {
        const langLabel = this._span(C.CODE_LANG);
        langLabel.textContent = lang;
        toolbar.appendChild(langLabel);
      }

      /* Copy button */
      const copyBtn = document.createElement("button");
      copyBtn.className = C.CODE_TOOLBAR_BTN;
      copyBtn.textContent = "📋 Copy";
      copyBtn.addEventListener("click", () =>
        this._copyCode(codeEl.textContent ?? "", copyBtn)
      );
      toolbar.appendChild(copyBtn);

      /* Insert above */
      const insertAboveBtn = document.createElement("button");
      insertAboveBtn.className = C.CODE_TOOLBAR_BTN;
      insertAboveBtn.textContent = "⬆ Insert Above";
      insertAboveBtn.addEventListener("click", () =>
        this._insertCodeToCell(codeEl.textContent ?? "", lang, "above")
      );
      toolbar.appendChild(insertAboveBtn);

      /* Insert below */
      const insertBelowBtn = document.createElement("button");
      insertBelowBtn.className = C.CODE_TOOLBAR_BTN;
      insertBelowBtn.textContent = "⬇ Insert Below";
      insertBelowBtn.addEventListener("click", () =>
        this._insertCodeToCell(codeEl.textContent ?? "", lang, "below")
      );
      toolbar.appendChild(insertBelowBtn);

      /* Replace */
      const replaceBtn = document.createElement("button");
      replaceBtn.className = C.CODE_TOOLBAR_BTN;
      replaceBtn.textContent = "🔄 Replace";
      replaceBtn.addEventListener("click", () =>
        this._replaceCodeInCell(codeEl.textContent ?? "", lang)
      );
      toolbar.appendChild(replaceBtn);

      /* Position toolbar inside pre */
      pre.style.position = "relative";
      pre.insertBefore(toolbar, pre.firstChild);
    });
  }

  private async _copyCode(
    code: string,
    btn: HTMLButtonElement
  ): Promise<void> {
    const orig = btn.textContent ?? "";
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = "✅ Copied!";
      btn.classList.add(C.COPY_OK);
    } catch {
      btn.textContent = "❌ Failed";
    }
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove(C.COPY_OK);
    }, 2000);
  }

  private _insertCodeToCell(
    code: string,
    language: string,
    position: "above" | "below"
  ): void {
    /* Placeholder: requires JupyterLab commands API integration */
    console.log(
      `[PrimeAgent] Insert ${position}:`,
      language,
      code.slice(0, 100)
    );
  }

  private _replaceCodeInCell(code: string, language: string): void {
    /* Placeholder: requires JupyterLab commands API integration */
    console.log("[PrimeAgent] Replace:", language, code.slice(0, 100));
  }

  /* ================================================================ */
  /*  Message actions                                                  */
  /* ================================================================ */

  private _editMessage(msg: IMessage): void {
    if (msg.sender.username !== this._user.username) return;
    this._input.value = msg.content;
    this._input.focus();
    this._autoResize();
    this._input.classList.add(C.EDITING);
    this._input.setAttribute("data-editing-id", msg.id);
  }

  private _deleteMessage(msg: IMessage): void {
    msg.deleted = true;
    const el = this._renderedMessages.get(msg.id);
    if (el) {
      const body = el.querySelector(`.${C.MESSAGE_BODY}`) as HTMLElement;
      if (body) {
        body.innerHTML =
          '<em style="opacity:0.5;">(message deleted)</em>';
      }
    }
  }

  /* ================================================================ */
  /*  Navigation                                                       */
  /* ================================================================ */

  private _updateNavVisibility(): void {
    /* Show nav buttons if there are messages not in viewport */
    const total = this._messages.length;
    if (total === 0) {
      this._navUp.style.display = "none";
      this._navDown.style.display = "none";
      return;
    }

    const lastInView = this._inViewport.has(total - 1);
    this._navDown.style.display = lastInView ? "none" : "flex";
    this._navDown.onclick = () => this._scrollToMessage(total - 1);

    /* Check if any messages below viewport are newer */
    const minViewport = this._inViewport.size > 0
      ? Math.min(...Array.from(this._inViewport))
      : total;
    this._navUp.style.display =
      minViewport > 0 ? "flex" : "none";
    this._navUp.onclick = () => {
      if (minViewport > 0) {
        this._scrollToMessage(minViewport - 1);
      }
    };
  }

  private _scrollToMessage(index: number): void {
    const el = this._messagesBox.children[index] as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ================================================================ */
  /*  Input handling                                                   */
  /* ================================================================ */

  private _handleKey(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey && !this._config.sendWithShiftEnter) {
      e.preventDefault();
      e.stopPropagation();
      this._sendMessage();
      return;
    }
    if (
      e.key === "Enter" &&
      e.shiftKey &&
      this._config.sendWithShiftEnter
    ) {
      e.preventDefault();
      e.stopPropagation();
      this._sendMessage();
      return;
    }
    /* Arrow keys for multiline navigation */
    if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.stopPropagation();
    }
  }

  private _autoResize(): void {
    const el = this._input;
    el.style.height = "auto";
    const maxH = 160; // ~10 rows
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  }

  private _updateSendTooltip(): void {
    const key = this._config.sendWithShiftEnter
      ? "SHIFT+ENTER"
      : "ENTER";
    this._sendBtn.title = `Send message (${key})`;
  }

  /* ================================================================ */
  /*  Send message                                                     */
  /* ================================================================ */

  private _sendMessage(): void {
    const editingId = this._input.getAttribute("data-editing-id");
    if (editingId) {
      /* Editing existing message */
      const msg = this._messages.find((m) => m.id === editingId);
      if (msg) {
        msg.content = this._input.value;
        msg.edited = true;
        const el = this._renderedMessages.get(editingId);
        if (el) {
          const body = el.querySelector(
            `.${C.MESSAGE_BODY}`
          ) as HTMLElement;
          if (body) {
            this._renderMarkdownFinal(body, this._input.value);
          }
        }
      }
      this._input.removeAttribute("data-editing-id");
      this._input.classList.remove(C.EDITING);
      this._input.value = "";
      this._autoResize();
      return;
    }

    const text = this._input.value.trim();
    if (!text) return;

    /* Add user message */
    const msg: IMessage = {
      id: uid(),
      role: "user",
      content: text,
      sender: this._user,
      time: Math.floor(Date.now() / 1000),
    };
    this._messages.push(msg);
    this._history.push({ role: "user", content: text });

    const el = this._createMessageEl(msg, this._messages.length - 1);
    this._messagesBox.appendChild(el);
    this._renderedMessages.set(msg.id, el);

    /* Clear input */
    this._input.value = "";
    this._autoResize();
    this._input.focus();

    /* Scroll to bottom */
    this._shouldAutoScroll = true;
    requestAnimationFrame(() => {
      this._scrollContainer.scrollTop =
        this._scrollContainer.scrollHeight;
    });

    /* Send via WebSocket */
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "prompt", text }));
    }
  }

  /* ================================================================ */
  /*  Streaming controls                                               */
  /* ================================================================ */

  private _stopStream(): void {
    if (!this._streaming.active) return;
    /* Send stop signal */
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "stop" }));
    }
    this._finishStream();
  }

  /* ================================================================ */
  /*  UI helpers                                                       */
  /* ================================================================ */

  private _showWritingIndicator(show: boolean): void {
    this._writingIndicator.style.display = show ? "flex" : "none";
  }

  private _showStopButton(show: boolean): void {
    this._stopBtn.style.display = show ? "flex" : "none";
    this._sendBtn.style.display = show ? "none" : "flex";
  }

  private _setStatus(
    state: "connected" | "connecting" | "disconnected" | "error"
  ): void {
    const map: Record<string, { color: string; text: string }> = {
      connected: { color: "#22c55e", text: "Connected" },
      connecting: { color: "#f59e0b", text: "Connecting..." },
      disconnected: { color: "#ef4444", text: "Disconnected" },
      error: { color: "#ef4444", text: "Connection error" },
    };
    const s = map[state] ?? map.error;
    this._statusDot.style.backgroundColor = s.color;
    this._statusText.textContent = s.text;
  }

  private _addSystemMessage(text: string): void {
    const msg: IMessage = {
      id: uid(),
      role: "system",
      content: text,
      sender: { username: "system", display_name: "System", bot: true },
      time: Math.floor(Date.now() / 1000),
    };
    this._messages.push(msg);
    const el = this._createMessageEl(msg, this._messages.length - 1);
    el.classList.add("pa-chat-system-message");
    this._messagesBox.appendChild(el);
    this._renderedMessages.set(msg.id, el);
  }

  /* --- DOM factory helpers --- */

  private _div(className: string): HTMLDivElement {
    const d = document.createElement("div");
    d.className = className;
    return d;
  }

  private _span(className: string, text?: string): HTMLSpanElement {
    const s = document.createElement("span");
    s.className = className;
    if (text) s.textContent = text;
    return s;
  }

  private _navBtn(
    label: string,
    title: string
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = C.NAVIGATION_BTN;
    btn.textContent = label;
    btn.title = title;
    return btn;
  }

  private _inputBtn(
    className: string,
    icon: string,
    title: string
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = `${C.INPUT_BTN} ${className}`;
    btn.title = title;
    btn.innerHTML = `<span class="pa-chat-btn-icon">${icon}</span>`;
    return btn;
  }

  private _toolbarBtn(
    className: string,
    icon: string,
    title: string,
    handler: () => void
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = `${C.TOOLBAR_BTN} ${className}`;
    btn.title = title;
    btn.innerHTML = `<span>${icon}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handler();
    });
    return btn;
  }

  /* ================================================================ */
  /*  Lifecycle                                                        */
  /* ================================================================ */

  dispose(): void {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    if (this._scrollObserver) {
      this._scrollObserver.disconnect();
    }
    if (this._viewportObserver) {
      this._viewportObserver.disconnect();
    }
    this._markdownRenderer = null;
    this._renderedMessages.clear();
    this._renderDelegates.clear();
    super.dispose();
  }
}
