import { RendererPlugin } from "../../rendererApi";
import CytoscapeRenderer from "./CytoscapeRenderer.vue";
import { cytoscapeRendererMeta } from "./meta";

/**
 * The cytoscape DAG renderer, as the app consumes it.
 *
 * Headless (node-side) export lives in ./headless so that jsdom and the canvas
 * backend it needs never reach the browser bundle.
 */
export const cytoscapePlugin: RendererPlugin = {
  ...cytoscapeRendererMeta,
  component: CytoscapeRenderer,
};
