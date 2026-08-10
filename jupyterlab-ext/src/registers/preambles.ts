import { Token } from '@lumino/coreutils';
import { IChatModel } from '../model';
import { IMessageContent } from '../types';

export type MessagePreambleProps = { model: IChatModel; message: IMessageContent; };

export interface IMessagePreambleRegistry {
  addComponent(component: (props: MessagePreambleProps) => JSX.Element | null): void;
  getComponents(): ((props: MessagePreambleProps) => JSX.Element | null)[];
}

export class MessagePreambleRegistry implements IMessagePreambleRegistry {
  addComponent(component: (props: MessagePreambleProps) => JSX.Element | null): void { this._components.push(component); }
  getComponents(): ((props: MessagePreambleProps) => JSX.Element | null)[] { return [...this._components]; }
  private _components: ((props: MessagePreambleProps) => JSX.Element | null)[] = [];
}
