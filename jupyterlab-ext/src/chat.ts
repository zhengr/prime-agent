/**
 * Chat UI component for Prime Agent.
 *
 * Vanilla DOM-based chat interface that connects to the prime-agent
 * WebSocket backend at /api/prime-agent/chat/{session}.
 * Supports streaming responses with real-time text rendering.
 */

/**
 * WebSocket message types matching the backend protocol.
 */
interface WsMessage {
  type: 'connected' | 'event' | 'done' | 'error' | 'stopped';
  sessionId?: string;
  agentBin?: string;
  cwd?: string;
  kind?: string;
  data?: Record<string, unknown>;
  message?: string;
  exitCode?: number;
}

/**
 * Client-to-server message types.
 */
interface WsPrompt {
  type: 'prompt';
  text: string;
}

interface WsStop {
  type: 'stop';
}

type WsSend = WsPrompt | WsStop;

/**
 * ChatPanel builds and manages the full chat UI inside a container element.
 */
export class ChatPanel {
  private _container: HTMLElement;
  private _outputEl!: HTMLElement;
  private _inputEl!: HTMLTextAreaElement;
  private _sendBtn!: HTMLButtonElement;
  private _stopBtn!: HTMLButtonElement;
  private _statusEl!: HTMLElement;
  private _ws: WebSocket | null = null;
  private _currentEl: HTMLElement | null = null;
  private _currentText: string = '';
  private _sessionId: string;
  private _disposed: boolean = false;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this._sessionId = this._generateSessionId();
    this._container = container;

    // Build DOM structure
    this._buildDOM();

    // Connect to WebSocket
    this._connect();
  }

  /**
   * Generate a unique session ID.
   */
  private _generateSessionId(): string {
    return `jlab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Build the chat UI DOM structure.
   */
  private _buildDOM(): void {
    // Header
    const header = document.createElement('div');
    header.className = 'prime-agent-header';

    const title = document.createElement('span');
    title.className = 'prime-agent-title';
    title.textContent = 'Prime Agent';

    this._statusEl = document.createElement('span');
    this._statusEl.className = 'prime-agent-status';
    this._statusEl.textContent = 'Connecting...';

    header.appendChild(title);
    header.appendChild(this._statusEl);

    // Output area (messages)
    this._outputEl = document.createElement('div');
    this._outputEl.className = 'prime-agent-output';

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'prime-agent-input-area';

    this._inputEl = document.createElement('textarea');
    this._inputEl.className = 'prime-agent-textarea';
    this._inputEl.placeholder = 'Ask Prime Agent... (Shift+Enter for newline)';
    this._inputEl.rows = 3;

    const btnRow = document.createElement('div');
    btnRow.className = 'prime-agent-btn-row';

    this._stopBtn = document.createElement('button');
    this._stopBtn.className = 'prime-agent-btn prime-agent-btn-stop';
    this._stopBtn.textContent = 'Stop';
    this._stopBtn.style.display = 'none';

    this._sendBtn = document.createElement('button');
    this._sendBtn.className = 'prime-agent-btn prime-agent-btn-send';
    this._sendBtn.textContent = 'Send';

    btnRow.appendChild(this._stopBtn);
    btnRow.appendChild(this._sendBtn);

    inputArea.appendChild(this._inputEl);
    inputArea.appendChild(btnRow);

    // Assemble
    this._container.appendChild(header);
    this._container.appendChild(this._outputEl);
    this._container.appendChild(inputArea);

    // Event listeners
    this._sendBtn.addEventListener('click', () => this._send());
    this._stopBtn.addEventListener('click', () => this._stop());
    this._inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._send();
      }
    });
  }

  /**
   * Establish WebSocket connection to the backend.
   */
  private _connect(): void {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/api/prime-agent/chat/${this._sessionId}`;

    this._ws = new WebSocket(url);

    this._ws.onopen = (): void => {
      this._setStatus('Connected', 'connected');
      this._addSystemMessage('Connected to Prime Agent');
    };

    this._ws.onmessage = (e: MessageEvent): void => {
      if (this._disposed) return;
      try {
        const msg: WsMessage = JSON.parse(e.data);
        this._handleMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    this._ws.onclose = (): void => {
      if (this._disposed) return;
      this._setStatus('Disconnected', 'error');
      this._scheduleReconnect();
    };

    this._ws.onerror = (): void => {
      if (this._disposed) return;
      this._setStatus('Error', 'error');
    };
  }

  /**
   * Schedule a reconnection attempt.
   */
  private _scheduleReconnect(): void {
    if (this._disposed || this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._disposed) {
        this._connect();
      }
    }, 3000);
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private _handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'connected':
        this._setStatus('Ready', 'connected');
        break;

      case 'event':
        this._handleEvent(msg.kind || 'unknown', msg.data || {});
        break;

      case 'done':
        this._finishResponse();
        break;

      case 'stopped':
        this._finishResponse();
        this._addSystemMessage('Stopped');
        break;

      case 'error':
        this._addErrorMessage(msg.message || 'Unknown error');
        this._setInputEnabled(true);
        break;
    }
  }

  /**
   * Handle streaming event data from the agent.
   */
  private _handleEvent(kind: string, data: Record<string, unknown>): void {
    // Start a new message bubble if needed
    if (!this._currentEl) {
      this._currentEl = document.createElement('div');
      this._currentEl.className = 'prime-agent-msg prime-agent-msg-agent';
      this._outputEl.appendChild(this._currentEl);
      this._currentText = '';
    }

    if (kind === 'text') {
      this._appendText(String(data.text || ''));
    } else if (kind === 'assistant' && data.content) {
      const content = data.content;
      let text = '';
      if (Array.isArray(content)) {
        text = content
          .filter((b: { type?: string }) => b.type === 'text')
          .map((b: { text?: string }) => b.text || '')
          .join('');
      } else if (typeof content === 'string') {
        text = content;
      }
      if (text) {
        this._appendText(text);
      }
    } else if (kind === 'tool_use') {
      this._appendText(`\n⚙️ ${String(data.name || 'tool')}\n`);
    } else if (kind === 'thinking' && data.text) {
      this._appendText(`\n💭 ${String(data.text)}\n`);
    } else if (kind === 'result' && data.result) {
      this._appendText(`\n${String(data.result)}\n`);
    }

    this._scrollToBottom();
  }

  /**
   * Append text to the current streaming message.
   */
  private _appendText(text: string): void {
    this._currentText += text;
    // Simple markdown-like rendering
    let html = this._escapeHtml(this._currentText)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    if (this._currentEl) {
      this._currentEl.innerHTML = html;
    }
  }

  /**
   * Finish the current streaming response.
   */
  private _finishResponse(): void {
    this._currentEl = null;
    this._currentText = '';
    this._setInputEnabled(true);
  }

  /**
   * HTML-escape a string.
   */
  private _escapeHtml(s: string): string {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /**
   * Add a system message to the output.
   */
  private _addSystemMessage(text: string): void {
    const el = document.createElement('div');
    el.className = 'prime-agent-msg prime-agent-msg-system';
    el.textContent = text;
    this._outputEl.appendChild(el);
    this._scrollToBottom();
  }

  /**
   * Add a user message to the output.
   */
  private _addUserMessage(text: string): void {
    const el = document.createElement('div');
    el.className = 'prime-agent-msg prime-agent-msg-user';
    el.textContent = text;
    this._outputEl.appendChild(el);
    this._scrollToBottom();
  }

  /**
   * Add an error message to the output.
   */
  private _addErrorMessage(text: string): void {
    const el = document.createElement('div');
    el.className = 'prime-agent-msg prime-agent-msg-error';
    el.textContent = `⚠️ ${text}`;
    this._outputEl.appendChild(el);
    this._scrollToBottom();
  }

  /**
   * Send the current prompt to the backend.
   */
  private _send(): void {
    const text = this._inputEl.value.trim();
    if (!text || !this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this._addUserMessage(text);
    this._inputEl.value = '';
    this._setInputEnabled(false);
    this._currentEl = null;
    this._currentText = '';

    const msg: WsPrompt = { type: 'prompt', text };
    this._ws.send(JSON.stringify(msg));
  }

  /**
   * Send a stop command to the backend.
   */
  private _stop(): void {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      const msg: WsStop = { type: 'stop' };
      this._ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Update the status indicator.
   */
  private _setStatus(text: string, state: string): void {
    this._statusEl.textContent = text;
    this._statusEl.className = `prime-agent-status prime-agent-status-${state}`;
  }

  /**
   * Enable or disable the input controls.
   */
  private _setInputEnabled(enabled: boolean): void {
    this._inputEl.disabled = !enabled;
    this._sendBtn.style.display = enabled ? '' : 'none';
    this._stopBtn.style.display = enabled ? 'none' : '';
    if (enabled) {
      this._inputEl.focus();
    }
  }

  /**
   * Scroll the output area to the bottom.
   */
  private _scrollToBottom(): void {
    requestAnimationFrame(() => {
      this._outputEl.scrollTop = this._outputEl.scrollHeight;
    });
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this._disposed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
}
