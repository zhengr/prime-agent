/**
 * Main plugin registration for the Prime Agent JupyterLab sidebar extension.
 *
 * Registers a sidebar widget in JupyterLab's left panel that provides
 * a chat interface connected to the prime-agent WebSocket backend.
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer,
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';

import { PrimeAgentWidget } from './widget';

/**
 * The command IDs used by the extension.
 */
const COMMAND_ID = 'prime-agent:open-chat';
const WIDGET_ID = 'prime-agent-chat';

/**
 * The main plugin that activates the sidebar chat widget.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: WIDGET_ID,
  autoStart: true,
  requires: [],
  optional: [ICommandPalette, ILayoutRestorer],
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette | null,
    restorer: ILayoutRestorer | null
  ): void => {
    const { commands, shell } = app;

    // Create the chat widget
    const widget = new PrimeAgentWidget();

    // Add the widget to the shell's left sidebar
    shell.add(widget, 'left', { rank: 100 });

    // Register the command to toggle the widget
    commands.addCommand(COMMAND_ID, {
      label: 'Prime Agent Chat',
      caption: 'Open Prime Agent Chat Panel',
      execute: () => {
        shell.activateById(widget.id);
      },
    });

    // Add to command palette if available
    if (palette) {
      palette.addItem({
        command: COMMAND_ID,
        category: 'Prime Agent',
        rank: 0,
      });
    }

    // Restore widget state across page reloads
    if (restorer) {
      restorer.add(widget, WIDGET_ID);
    }

    console.log('Prime Agent JupyterLab extension activated');
  },
};

export default plugin;
