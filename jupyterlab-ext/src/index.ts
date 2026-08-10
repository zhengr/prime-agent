/**
 * Prime Agent JupyterLab Extension
 * Plugin registration
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { ILayoutRestorer } from '@jupyterlab/application';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { PrimeAgentWidget } from './widget';

/**
 * Plugin ID
 */
const PLUGIN_ID = 'prime-agent-jupyterlab';

/**
 * Prime Agent plugin
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  autoStart: true,
  optional: [ILayoutRestorer],
  requires: [IRenderMimeRegistry],
  activate: (
    app: JupyterFrontEnd,
    rendermime: IRenderMimeRegistry,
    restorer: ILayoutRestorer | null
  ) => {
    console.log('[Prime Agent] Activating extension...');

    // Create the widget
    const widget = new PrimeAgentWidget(rendermime);
    widget.id = PLUGIN_ID;
    widget.title.label = 'Prime Agent';
    widget.title.closable = true;
    widget.title.iconClass = 'prime-agent-tab-icon';

    // Add to sidebar
    app.shell.add(widget, 'left', { rank: 100 });

    // Restore state
    if (restorer) {
      restorer.add(widget, PLUGIN_ID);
    }

    console.log('[Prime Agent] Extension activated');
  },
};

export default plugin;
