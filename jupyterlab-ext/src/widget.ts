/**
 * Sidebar widget for Prime Agent chat.
 *
 * Uses JupyterLab's widget system. The widget content is built with
 * vanilla DOM manipulation (no React).
 */

import { Widget } from '@lumino/widgets';

import { ChatPanel } from './chat';

/**
 * The sidebar widget that wraps the chat panel.
 * Extends JupyterLab's Widget (which wraps Lumino Widget internally).
 */
export class PrimeAgentWidget extends Widget {
  private _chatPanel: ChatPanel;

  constructor() {
    const node = document.createElement('div');
    node.classList.add('prime-agent-widget');
    super({ node });

    this.id = 'prime-agent-chat';
    this.title.label = 'Prime Agent';
    this.title.closable = true;

    // Add icon class for the sidebar tab
    this.title.iconClass = 'jp-ChatIcon prime-agent-icon';

    // Build the chat panel inside the widget node
    this._chatPanel = new ChatPanel(node);
  }

  /**
   * Dispose the widget and clean up resources.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._chatPanel.dispose();
    super.dispose();
  }
}
