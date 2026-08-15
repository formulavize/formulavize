import {
  BACKGROUND_COLOR_PROPERTY,
  CYTOSCAPE_RENDERER_NAME,
} from "../../compiler/constants";
import { Dag, DagStyle, StyleProperties } from "../../compiler/dag";

// Resolve a binding's style tags and inline properties into a single map,
// matching the precedence used throughout renderer-directive processing: tags
// are applied in declaration order and inline properties win over all of them.
function resolveBindingProperties(
  dag: Dag,
  dagStyle: DagStyle,
): StyleProperties {
  const tagProperties = dagStyle.styleTags.map(
    (styleTag) => dag.getStyle(styleTag) ?? new Map<string, string>(),
  );
  return new Map([
    ...tagProperties.flatMap((properties) => Array.from(properties)),
    ...dagStyle.styleProperties,
  ]);
}

/**
 * Resolved properties from the '^<rendererName>' directive block on the given Dag.
 *
 * Directives describe things cytoscape has no stylesheet properties for, such
 * as the drawing surface and the layout, so they are consumed by the renderer
 * directly and never emitted as a selector. Style tags resolve with the same
 * precedence as style bindings: tags in declaration order, inline properties win.
 */
export function getRendererDirectiveProperties(
  dag: Dag,
  rendererName: string,
): StyleProperties {
  const directive = dag.getRendererDirectives().get(rendererName);
  if (!directive) return new Map();
  return resolveBindingProperties(dag, directive);
}

export function getCytoscapeDirectiveProperties(dag: Dag): StyleProperties {
  return getRendererDirectiveProperties(dag, CYTOSCAPE_RENDERER_NAME);
}

export function getCanvasBackgroundColor(dag: Dag): string | undefined {
  return getCytoscapeDirectiveProperties(dag).get(BACKGROUND_COLOR_PROPERTY);
}
