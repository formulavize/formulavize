import { Dag, StyleProperties } from "../../compiler/dag";
import { getRendererDirectiveProperties } from "../../rendererApi";
import {
  BACKGROUND_COLOR_PROPERTY,
  CYTOSCAPE_RENDERER_NAME,
} from "./constants";

/**
 * Resolved properties from this dag's '^cytoscape' directive block.
 *
 * Directives describe things cytoscape has no stylesheet properties for, such
 * as the drawing surface and the layout, so they are consumed by the renderer
 * directly and never emitted as a selector.
 */
export function getCytoscapeDirectiveProperties(dag: Dag): StyleProperties {
  return getRendererDirectiveProperties(dag, CYTOSCAPE_RENDERER_NAME);
}

export function getCanvasBackgroundColor(dag: Dag): string | undefined {
  return getCytoscapeDirectiveProperties(dag).get(BACKGROUND_COLOR_PROPERTY);
}
