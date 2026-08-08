import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from "@jupyterlab/application";
import { ILayoutRestorer } from "@jupyterlab/application";
import { IRenderMimeRegistry } from "@jupyterlab/rendermime";
import { PrimeAgentWidget } from "./widget";

const PLUGIN_ID = "prime-agent-jupyterlab";

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
    const widget = new PrimeAgentWidget(rendermime);
    widget.id = PLUGIN_ID;
    widget.title.label = "Prime Agent";
    widget.title.closable = true;
    widget.title.iconClass = "prime-agent-tab-icon";

    app.shell.add(widget, "left", { rank: 100 });

    if (restorer) {
      restorer.add(widget, PLUGIN_ID);
    }

    console.log("Prime Agent extension activated");
  },
};

export default plugin;
