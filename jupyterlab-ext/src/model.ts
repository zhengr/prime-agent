import { IDisposable } from '@lumino/disposable';
import { ISignal, Signal } from '@lumino/signaling';
import { Message } from './message';
import { IInputModel, InputModel } from './input-model';
import { IConfig, IMessage, IMessageContent, INewMessage, IUser } from './types';

export interface IChatModel extends IDisposable {
  name: string;
  config: IConfig;
  user?: IUser;
  messages: IMessage[];
  input: IInputModel;
  writers: IChatModel.IWriter[];
  messagesUpdated: ISignal<IChatModel, void>;
  configChanged: ISignal<IChatModel, IConfig>;
  writersChanged?: ISignal<IChatModel, IChatModel.IWriter[]>;
  messageChanged: ISignal<IChatModel, IMessage>;
  viewportChanged?: ISignal<IChatModel, number[]>;
  messagesInViewport?: number[];
  sendMessage(message: INewMessage): void;
  clearMessages(): void;
  messageAdded(message: IMessageContent): void;
  updateWriters(writers: IChatModel.IWriter[]): void;
  updateMessage?(id: string, message: IMessageContent): void;
  deleteMessage?(id: string): void;
  getEditionModel?(id: string): IInputModel | undefined;
  addEditionModel?(id: string, model: IInputModel): void;
  createChatContext(): any;
  dispose(): void;
  isDisposed: boolean;
}

export namespace IChatModel {
  export interface IWriter {
    user: IUser;
    messageID?: string;
  }
  export interface IOptions {
    config?: IConfig;
  }
}

export class PrimeAgentChatModel implements IChatModel {
  constructor(options: IChatModel.IOptions = {}) {
    this._config = { stackMessages: true, ...options.config };
    this._inputModel = new InputModel({
      onSend: this.sendMessage.bind(this),
      config: { sendWithShiftEnter: this._config.sendWithShiftEnter }
    });
    this._ws = null;
    this._currentAssistantMessage = null;
    this._streamingBuffer = '';
  }

  get name(): string { return this._name; }
  set name(v: string) { this._name = v; }
  get config(): IConfig { return this._config; }
  set config(v: Partial<IConfig>) { this._config = { ...this._config, ...v }; this._configChanged.emit(this._config); this._inputModel.config = v; }
  get user(): IUser | undefined { return this._user; }
  set user(v: IUser | undefined) { this._user = v; }
  get messages(): IMessage[] { return this._messages; }
  get input(): IInputModel { return this._inputModel; }
  get writers(): IChatModel.IWriter[] { return this._writers; }
  get messagesUpdated(): ISignal<IChatModel, void> { return this._messagesUpdated; }
  get configChanged(): ISignal<IChatModel, IConfig> { return this._configChanged; }
  get writersChanged(): ISignal<IChatModel, IChatModel.IWriter[]> { return this._writersChanged; }
  get messageChanged(): ISignal<IChatModel, IMessage> { return this._messageChanged; }
  get viewportChanged(): ISignal<IChatModel, number[]> { return this._viewportChanged; }
  get messagesInViewport(): number[] { return this._messagesInViewport; }
  set messagesInViewport(v: number[]) { this._messagesInViewport = v; this._viewportChanged.emit(v); }
  get isDisposed(): boolean { return this._isDisposed; }

  connectWebSocket(url: string): void {
    try {
      this._ws = new WebSocket(url);
      this._ws.onopen = () => {
        console.log('[PrimeAgent] WebSocket connected');
        this.updateWriters([{ user: { username: 'system', display_name: 'Connected', bot: true } }]);
        setTimeout(() => this.updateWriters([]), 2000);
      };
      this._ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) { console.error('[PrimeAgent] Parse error:', e); }
      };
      this._ws.onerror = (e) => console.error('[PrimeAgent] WebSocket error:', e);
      this._ws.onclose = () => {
        console.log('[PrimeAgent] WebSocket disconnected');
        setTimeout(() => { if (!this._ws || this._ws.readyState === WebSocket.CLOSED) { this.connectWebSocket(url); } }, 5000);
      };
    } catch (e) { console.error('[PrimeAgent] Failed to connect:', e); }
  }

  private _handleMessage(msg: any): void {
    if (msg.type === 'event') {
      const kind = msg.kind;
      const data = msg.data?.data || msg.data || {};
      const text = data.text || data.content || '';

      if (kind === 'message_start' || kind === 'thinking_start') {
        this._streamingBuffer = '';
        this._currentAssistantMessage = new Message({
          type: 'msg', body: '', id: `assistant-${Date.now()}`, time: Date.now() / 1000,
          sender: { username: 'assistant', display_name: 'Assistant', bot: true }
        });
        this._messages.push(this._currentAssistantMessage);
        this._messagesUpdated.emit();
        this.updateWriters([{ user: { username: 'assistant', display_name: 'Assistant', bot: true } }]);
      } else if (kind === 'message_delta' || kind === 'thinking_delta') {
        if (this._currentAssistantMessage && text) {
          this._streamingBuffer += text;
          this._currentAssistantMessage.update({ body: this._streamingBuffer });
        }
      } else if (kind === 'message_stop' || kind === 'thinking_stop') {
        if (this._currentAssistantMessage && this._streamingBuffer) {
          this._currentAssistantMessage.update({ body: this._streamingBuffer });
        }
        this._currentAssistantMessage = null;
        this._streamingBuffer = '';
        this.updateWriters([]);
      }
    } else if (msg.type === 'error') {
      const text = msg.text || msg.message || 'Unknown error';
      const errorMessage = new Message({
        type: 'msg', body: `**Error:** ${text}`, id: `error-${Date.now()}`, time: Date.now() / 1000,
        sender: { username: 'system', display_name: 'System' }
      });
      this._messages.push(errorMessage);
      this._messagesUpdated.emit();
      this.updateWriters([]);
    }
  }

  sendMessage(message: INewMessage): void {
    const body = message.body;
    if (!body || !body.trim()) return;

    const userMessage = new Message({
      type: 'msg', body, id: `user-${Date.now()}`, time: Date.now() / 1000,
      sender: this._user || { username: 'user', display_name: 'User' }
    });
    this._messages.push(userMessage);
    this._messagesUpdated.emit();

    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'prompt', text: body }));
      this.updateWriters([{ user: { username: 'assistant', display_name: 'Assistant', bot: true } }]);
    }
  }

  clearMessages(): void { this._messages = []; this._messagesUpdated.emit(); }

  messageAdded(message: IMessageContent): void {
    const msg = new Message(message);
    this._messages.push(msg);
    this._messagesUpdated.emit();
  }

  updateWriters(writers: IChatModel.IWriter[]): void {
    this._writers = writers;
    this._writersChanged.emit(writers);
  }

  updateMessage(id: string, content: IMessageContent): void {
    const msg = this._messages.find(m => m.id === id);
    if (msg) {
      msg.update(content);
      this._messagesUpdated.emit();
    }
  }

  deleteMessage(id: string): void {
    const msg = this._messages.find(m => m.id === id);
    if (msg) {
      msg.update({ deleted: true });
      this._messagesUpdated.emit();
    }
  }

  getEditionModel(id: string): IInputModel | undefined {
    return this._editionModels.get(id);
  }

  addEditionModel(id: string, model: IInputModel): void {
    this._editionModels.set(id, model);
  }

  createChatContext(): any {
    return { name: this._name, messages: this._messages.map(m => ({ ...m.content })), user: this._user };
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    if (this._ws) { this._ws.close(); this._ws = null; }
    Signal.clearData(this);
  }

  private _name = 'Prime Agent';
  private _config: IConfig;
  private _user?: IUser;
  private _messages: IMessage[] = [];
  private _inputModel: IInputModel;
  private _writers: IChatModel.IWriter[] = [];
  private _ws: WebSocket | null = null;
  private _currentAssistantMessage: Message | null = null;
  private _streamingBuffer = '';
  private _isDisposed = false;
  private _messagesInViewport: number[] = [];
  private _editionModels = new Map<string, IInputModel>();
  private _messagesUpdated = new Signal<IChatModel, void>(this);
  private _configChanged = new Signal<IChatModel, IConfig>(this);
  private _writersChanged = new Signal<IChatModel, IChatModel.IWriter[]>(this);
  private _messageChanged = new Signal<IChatModel, IMessage>(this);
  private _viewportChanged = new Signal<IChatModel, number[]>(this);
}
