import { ExportFormat, RendererDescriptor } from "../../rendererApi";
import { cytoscapeCompletions } from "./completions";
import { CYTOSCAPE_RENDERER_NAME } from "./constants";

/**
 * The cytoscape renderer minus the component that draws it.
 *
 * Kept apart from ./index so the node-side entry point (./headless) can
 * describe this renderer without importing CytoscapeRenderer.vue, which pulls
 * in cytoscape-svg and reaches for `window` the moment it is loaded.
 */
export const cytoscapeRendererMeta: RendererDescriptor = {
  name: CYTOSCAPE_RENDERER_NAME,
  displayName: "Cytoscape Renderer",
  supportedExportFormats: [
    ExportFormat.PNG,
    ExportFormat.JPG,
    ExportFormat.SVG,
  ],
  completions: cytoscapeCompletions,
};
