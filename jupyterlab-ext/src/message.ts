import { PromiseDelegate } from '@lumino/coreutils';
import { ISignal, Signal } from '@lumino/signaling';
import { IMessageContent, IMessage, IUser, IAttachment, IMessageMetadata } from './types';

export class Message implements IMessage {
  constructor(content: IMessageContent) {
    this._content = content;
  }

  get content(): IMessageContent { return this._content; }
  get type(): string { return this._content.type; }
  get body(): string { return this._content.body; }
  get id(): string { return this._content.id; }
  get time(): number { return this._content.time; }
  get sender(): IUser { return this._content.sender; }
  get attachments(): IAttachment[] | undefined { return this._content.attachments; }
  get mentions(): IUser[] | undefined { return this._content.mentions; }
  get deleted(): boolean | undefined { return this._content.deleted; }
  get edited(): boolean | undefined { return this._content.edited; }
  get stacked(): boolean | undefined { return this._content.stacked; }

  get changed(): ISignal<IMessage, void> { return this._changed; }
  get renderedDelegate(): PromiseDelegate<void> { return this._rendered; }

  update(updated: Partial<IMessageContent>) {
    const triggerRerender = new Set(['body', 'deleted', 'mentions', 'mime_model']);
    const shouldRerender = Object.keys(updated).some(
      k => triggerRerender.has(k) && (updated as any)[k] !== (this._content as any)[k]
    );
    this._content = { ...this._content, ...updated };
    if (shouldRerender) { this._rendered = new PromiseDelegate<void>(); }
    this._changed.emit();
  }

  private _content: IMessageContent;
  private _changed = new Signal<IMessage, void>(this);
  private _rendered = new PromiseDelegate<void>();
}
