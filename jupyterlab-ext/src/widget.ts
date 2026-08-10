/**
 * Prime Agent Widget
 * Lumino Widget with React root for JupyterLab sidebar
 */

import { Widget } from '@lumino/widgets';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { Chat } from './components/chat';
import { PrimeAgentChatModel } from './model';

const WIDGET_CLASS = 'jp-PrimeAgentWidget';

export class PrimeAgentWidget extends Widget {
  constructor(rendermime: IRenderMimeRegistry) {
    super();
    this.addClass(WIDGET_CLASS);
    this.addClass('pa-chat-widget');

    this._rendermime = rendermime;
    this._model = new PrimeAgentChatModel();

    // Create React root
    this._root = createRoot(this.node);
    this._renderReact();

    // Connect to WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/prime-agent/chat/default`;
    this._model.connectWebSocket(wsUrl);

    console.log('[Prime Agent] Widget created, WebSocket:', wsUrl);
  }

  private _renderReact(): void {
    this._root.render(
      React.createElement(Chat, {
        model: this._model,
        rmRegistry: this._rendermime,
      })
    );
  }

  get model(): PrimeAgentChatModel {
    return this._model;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._model.dispose();
    this._root.unmount();
    super.dispose();
    console.log('[Prime Agent] Widget disposed');
  }

  private _rendermime: IRenderMimeRegistry;
  private _model: PrimeAgentChatModel;
  private _root: Root;
}
