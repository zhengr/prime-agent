import { UUID } from '@lumino/coreutils';
import { IDisposable } from '@lumino/disposable';
import { ISignal, Signal } from '@lumino/signaling';
import { IAttachment, INewMessage } from './types';

export interface IInputModel extends IDisposable {
  value: string;
  valueChanged: ISignal<IInputModel, string>;
  cursorIndex: number | null;
  currentWord: string | null;
  currentWordChanged: ISignal<IInputModel, string | null>;
  config: InputModel.IConfig;
  configChanged: ISignal<IInputModel, InputModel.IConfig>;
  focus(): void;
  focusInputSignal: ISignal<IInputModel, void>;
  attachments: IAttachment[];
  addAttachment?(attachment: IAttachment): void;
  removeAttachment?(attachment: IAttachment): void;
  clearAttachments(): void;
  attachmentsChanged: ISignal<IInputModel, IAttachment[]>;
  replaceCurrentWord(newWord: string): void;
  send: (content: string) => void;
  cancel?: (() => void) | undefined;
  id: string;
  onDisposed: ISignal<IInputModel, void>;
}

export class InputModel implements IInputModel {
  constructor(options: InputModel.IOptions) {
    this._id = options.id ?? `input-${UUID.uuid4()}`;
    this._onSend = options.onSend;
    this._value = options.value || '';
    this._attachments = options.attachments || [];
    this.cursorIndex = options.value ? options.value.length : 0;
    this._config = { ...options.config };
    this.cancel = options.onCancel;
  }

  get id(): string { return this._id; }
  get value(): string { return this._value; }
  set value(v: string) { this._value = v; this._valueChanged.emit(v); }
  get valueChanged(): ISignal<IInputModel, string> { return this._valueChanged; }
  get cursorIndex(): number | null { return this._cursorIndex; }
  set cursorIndex(v: number | null) {
    this._cursorIndex = v;
    this._cursorIndexChanged.emit(v);
    if (v !== null) {
      const word = Private.getCurrentWord(this._value, v);
      if (word !== this._currentWord) { this._currentWord = word; this._currentWordChanged.emit(word); }
    }
  }
  get currentWord(): string | null { return this._currentWord; }
  get currentWordChanged(): ISignal<IInputModel, string | null> { return this._currentWordChanged; }
  get config(): InputModel.IConfig { return this._config; }
  set config(v: Partial<InputModel.IConfig>) { this._config = { ...this._config, ...v }; this._configChanged.emit(this._config); }
  get configChanged(): ISignal<IInputModel, InputModel.IConfig> { return this._configChanged; }
  get focusInputSignal(): ISignal<IInputModel, void> { return this._focusInputSignal; }
  get attachments(): IAttachment[] { return this._attachments; }
  get attachmentsChanged(): ISignal<IInputModel, IAttachment[]> { return this._attachmentsChanged; }
  get onDisposed(): ISignal<IInputModel, void> { return this._onDisposed; }
  get isDisposed(): boolean { return this._isDisposed; }

  focus(): void { this._focusInputSignal.emit(); }
  addAttachment = (attachment: IAttachment): void => {
    const json = JSON.stringify(attachment);
    if (this._attachments.find(a => JSON.stringify(a) === json)) return;
    this._attachments.push(attachment);
    this._attachmentsChanged.emit([...this._attachments]);
  };
  removeAttachment = (attachment: IAttachment): void => {
    const idx = this._attachments.findIndex(a => JSON.stringify(a) === JSON.stringify(attachment));
    if (idx === -1) return;
    this._attachments.splice(idx, 1);
    this._attachmentsChanged.emit([...this._attachments]);
  };
  clearAttachments = (): void => { this._attachments = []; this._attachmentsChanged.emit([]); };
  replaceCurrentWord(newWord: string): void {
    if (this.cursorIndex === null) return;
    const [start, end] = Private.getCurrentWordBoundaries(this.value, this.cursorIndex);
    this.value = this.value.slice(0, start) + newWord + this.value.slice(end);
  }
  send = (input: string): void => {
    const message: INewMessage = { body: input };
    if (this.attachments.length) message.attachments = [...this.attachments];
    this._onSend(message);
    this.value = '';
    this.clearAttachments();
  };
  cancel?: (() => void) | undefined;
  dispose(): void { if (this._isDisposed) return; this._onDisposed.emit(); this._isDisposed = true; }

  private _id: string;
  private _onSend: (message: INewMessage) => void;
  private _value: string;
  private _cursorIndex: number | null = null;
  private _currentWord: string | null = null;
  private _attachments: IAttachment[];
  private _config: InputModel.IConfig;
  private _valueChanged = new Signal<IInputModel, string>(this);
  private _cursorIndexChanged = new Signal<IInputModel, number | null>(this);
  private _currentWordChanged = new Signal<IInputModel, string | null>(this);
  private _configChanged = new Signal<IInputModel, InputModel.IConfig>(this);
  private _focusInputSignal = new Signal<IInputModel, void>(this);
  private _attachmentsChanged = new Signal<IInputModel, IAttachment[]>(this);
  private _onDisposed = new Signal<IInputModel, void>(this);
  private _isDisposed = false;
}

export namespace InputModel {
  export interface IOptions {
    onSend: (message: INewMessage) => void;
    onCancel?: () => void;
    value?: string;
    attachments?: IAttachment[];
    id?: string;
    config?: IConfig;
  }
  export interface IConfig {
    sendWithShiftEnter?: boolean;
    sendWithSelection?: boolean;
  }
}

namespace Private {
  const WHITESPACE = new Set([' ', '\n', '\t']);
  export function getCurrentWordBoundaries(input: string, cursorIndex: number): [number, number] {
    let start = cursorIndex;
    let end = cursorIndex;
    const n = input.length;
    while ((start - 1 >= 0 && !WHITESPACE.has(input[start - 1])) || (start - 2 >= 0 && input[start - 2] === '\\' && WHITESPACE.has(input[start - 1]))) { start--; }
    while ((end < n && !WHITESPACE.has(input[end])) || (end < n && end - 1 >= 0 && input[end - 1] === '\\' && WHITESPACE.has(input[end]))) { end++; }
    return [start, end];
  }
  export function getCurrentWord(input: string, cursorIndex: number): string | null {
    const [start, end] = getCurrentWordBoundaries(input, cursorIndex);
    return input.slice(start, end);
  }
}
