import { ISignal, Signal } from '@lumino/signaling';
import * as React from 'react';
import { AttachButton, CancelButton, SaveEditButton, SendButton } from './buttons';
import { IInputModel } from '../../input-model';
import { IChatCommandRegistry } from '../../registers';
import { IChatModel } from '../../model';

export interface IInputToolbarRegistry {
  readonly itemsChanged: ISignal<IInputToolbarRegistry, void>;
  getItems(): InputToolbarRegistry.IToolbarItem[];
  addItem(name: string, item: InputToolbarRegistry.IToolbarItem): void;
  hide(name: string): void;
  show(name: string): void;
}

export class InputToolbarRegistry implements IInputToolbarRegistry {
  get itemsChanged(): ISignal<IInputToolbarRegistry, void> { return this._itemsChanged; }
  getItems(): InputToolbarRegistry.IToolbarItem[] {
    return Array.from(this._items.values()).filter(item => !item.hidden).sort((a, b) => a.position - b.position);
  }
  addItem(name: string, item: InputToolbarRegistry.IToolbarItem): void {
    if (!this._items.has(name)) { this._items.set(name, item); this._itemsChanged.emit(); }
  }
  hide(name: string): void { const item = this._items.get(name); if (item) { item.hidden = true; this._itemsChanged.emit(); } }
  show(name: string): void { const item = this._items.get(name); if (item) { item.hidden = false; this._itemsChanged.emit(); } }
  private _items = new Map<string, InputToolbarRegistry.IToolbarItem>();
  private _itemsChanged = new Signal<this, void>(this);
}

export namespace InputToolbarRegistry {
  export interface IToolbarItem {
    element: React.FunctionComponent<IToolbarItemProps>;
    position: number;
    hidden?: boolean;
  }
  export interface IToolbarItemProps {
    model: IInputModel;
    chatCommandRegistry?: IChatCommandRegistry;
    chatModel?: IChatModel;
    edit?: boolean;
  }
  export function defaultToolbarRegistry(): InputToolbarRegistry {
    const registry = new InputToolbarRegistry();
    registry.addItem('send', { element: SendButton, position: 100 });
    registry.addItem('saveEdit', { element: SaveEditButton, position: 95 });
    registry.addItem('cancel', { element: CancelButton, position: 10 });
    return registry;
  }
}
