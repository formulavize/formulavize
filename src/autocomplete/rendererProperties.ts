import { Completion } from "@codemirror/autocomplete";
import {
  BACKGROUND_COLOR_PROPERTY,
  CYTOSCAPE_LAYOUT_NAMES,
  CYTOSCAPE_RENDERER_NAME,
  DEFAULT_CYTOSCAPE_LAYOUT,
  DESCRIPTION_PREFIX,
  DESCRIPTION_PROPERTY,
  LAYOUT_PROPERTY,
} from "../compiler/constants";
import {
  CyLayoutName,
  getLayoutOptionKeys,
} from "../renderers/cyDag/cyLayoutSchema";

// Cytoscape properties sourced from https://js.cytoscape.org/#style

// Node body
const CYTOSCAPE_NODE_BODY_PROPERTIES = [
  "height",
  "width",
  "shape",
  "shape-polygon-points",
  "corner-radius",
  "background-color",
  "background-fill",
  "background-opacity",
  "background-blacken",
  "background-gradient-stop-colors",
  "background-gradient-stop-positions",
  "background-gradient-direction",
  "padding",
  "padding-relative-to",
  "bounds-expansion",
];

// Node border
const CYTOSCAPE_NODE_BORDER_PROPERTIES = [
  "border-color",
  "border-opacity",
  "border-width",
  "border-style",
  "border-cap",
  "border-join",
  "border-dash-pattern",
  "border-dash-offset",
  "border-position",
];

// Node outline
const CYTOSCAPE_NODE_OUTLINE_PROPERTIES = [
  "outline-color",
  "outline-opacity",
  "outline-width",
  "outline-style",
  "outline-offset",
];

// Background image
const CYTOSCAPE_BACKGROUND_IMAGE_PROPERTIES = [
  "background-image",
  "background-image-crossorigin",
  "background-image-opacity",
  "background-image-containment",
  "background-image-smoothing",
  "background-position-x",
  "background-position-y",
  "background-width-relative-to",
  "background-height-relative-to",
  "background-repeat",
  "background-fit",
  "background-clip",
  "background-width",
  "background-height",
  "background-offset-x",
  "background-offset-y",
];

// Labels — main, source, target
const CYTOSCAPE_LABEL_PROPERTIES = [
  "label",
  "text-rotation",
  "text-margin-x",
  "text-margin-y",
  "source-label",
  "source-text-rotation",
  "source-text-margin-x",
  "source-text-margin-y",
  "source-text-offset",
  "target-label",
  "target-text-rotation",
  "target-text-margin-x",
  "target-text-margin-y",
  "target-text-offset",
];

// Label dimensions and styling
const CYTOSCAPE_LABEL_STYLE_PROPERTIES = [
  "font-family",
  "font-style",
  "font-weight",
  "font-size",
  "text-transform",
  "text-wrap",
  "text-overflow-wrap",
  "text-max-width",
  "text-outline-width",
  "line-height",
  "text-valign",
  "text-halign",
  "color",
  "text-outline-color",
  "text-outline-opacity",
  "text-background-color",
  "text-background-opacity",
  "text-background-padding",
  "text-border-opacity",
  "text-border-color",
  "text-border-width",
  "text-border-style",
  "text-background-shape",
  "text-justification",
];

// Visibility
const CYTOSCAPE_VISIBILITY_PROPERTIES = [
  "display",
  "visibility",
  "opacity",
  "text-opacity",
  "min-zoomed-font-size",
  "z-index",
];

// Edge line
const CYTOSCAPE_EDGE_LINE_PROPERTIES = [
  "line-style",
  "line-color",
  "line-fill",
  "line-cap",
  "line-opacity",
  "line-dash-pattern",
  "line-dash-offset",
  "line-outline-width",
  "line-outline-color",
  "line-gradient-stop-colors",
  "line-gradient-stop-positions",
  "curve-style",
  "haystack-radius",
  "source-endpoint",
  "target-endpoint",
  "control-point-step-size",
  "control-point-distances",
  "control-point-weights",
  "segment-distances",
  "segment-weights",
  "segment-radii",
  "radius-type",
  "taxi-turn",
  "taxi-turn-min-distance",
  "taxi-direction",
  "taxi-radius",
  "edge-distances",
  "arrow-scale",
  "loop-direction",
  "loop-sweep",
  "source-distance-from-node",
  "target-distance-from-node",
];

// Edge arrows (source, mid-source, target, mid-target)
const CYTOSCAPE_EDGE_ARROW_PROPERTIES = [
  "source-arrow-shape",
  "source-arrow-color",
  "source-arrow-fill",
  "source-arrow-width",
  "mid-source-arrow-shape",
  "mid-source-arrow-color",
  "mid-source-arrow-fill",
  "mid-source-arrow-width",
  "target-arrow-shape",
  "target-arrow-color",
  "target-arrow-fill",
  "target-arrow-width",
  "mid-target-arrow-shape",
  "mid-target-arrow-color",
  "mid-target-arrow-fill",
  "mid-target-arrow-width",
];

// Label-applicable visibility properties for descriptions
const DESCRIPTION_VISIBILITY_PROPERTIES = [
  "text-opacity",
  "min-zoomed-font-size",
];

// text-halign and text-valign are excluded from description properties because
// in Cytoscape they control label *position* relative to the node body (e.g.
// "right" places the label to the right of the node), not text alignment within
// a block. This makes them incompatible with ghost-node-based description export.
const DESCRIPTION_EXCLUDED_PROPERTIES = new Set(["text-halign", "text-valign"]);

// Description style properties (description + description-* variants)
const DESCRIPTION_PROPERTIES = [
  DESCRIPTION_PROPERTY,
  ...CYTOSCAPE_LABEL_STYLE_PROPERTIES.filter(
    (p) => !DESCRIPTION_EXCLUDED_PROPERTIES.has(p),
  ).map((p) => DESCRIPTION_PREFIX + p),
  ...DESCRIPTION_VISIBILITY_PROPERTIES.map((p) => DESCRIPTION_PREFIX + p),
];

function buildCompletions(properties: string[]): Completion[] {
  const unique = [...new Set(properties)].sort();
  return unique.map((label) => ({ label, type: "property" }));
}

const cytoscapeCompletions = buildCompletions([
  ...CYTOSCAPE_NODE_BODY_PROPERTIES,
  ...CYTOSCAPE_NODE_BORDER_PROPERTIES,
  ...CYTOSCAPE_NODE_OUTLINE_PROPERTIES,
  ...CYTOSCAPE_BACKGROUND_IMAGE_PROPERTIES,
  ...CYTOSCAPE_LABEL_PROPERTIES,
  ...CYTOSCAPE_LABEL_STYLE_PROPERTIES,
  ...CYTOSCAPE_VISIBILITY_PROPERTIES,
  ...CYTOSCAPE_EDGE_LINE_PROPERTIES,
  ...CYTOSCAPE_EDGE_ARROW_PROPERTIES,
  ...DESCRIPTION_PROPERTIES,
]);

// Shared properties applicable to both nodes and edges
const CYTOSCAPE_SHARED_PROPERTIES = [
  ...CYTOSCAPE_LABEL_PROPERTIES,
  ...CYTOSCAPE_LABEL_STYLE_PROPERTIES,
  ...CYTOSCAPE_VISIBILITY_PROPERTIES,
  ...DESCRIPTION_PROPERTIES,
];

const cytoscapeNodeCompletions = buildCompletions([
  ...CYTOSCAPE_NODE_BODY_PROPERTIES,
  ...CYTOSCAPE_NODE_BORDER_PROPERTIES,
  ...CYTOSCAPE_NODE_OUTLINE_PROPERTIES,
  ...CYTOSCAPE_BACKGROUND_IMAGE_PROPERTIES,
  ...CYTOSCAPE_SHARED_PROPERTIES,
]);

const cytoscapeEdgeCompletions = buildCompletions([
  ...CYTOSCAPE_EDGE_LINE_PROPERTIES,
  ...CYTOSCAPE_EDGE_ARROW_PROPERTIES,
  ...CYTOSCAPE_SHARED_PROPERTIES,
]);

// Properties consumed directly by the cytoscape renderer from a
// '^cytoscape{ }' directive. These are not cytoscape stylesheet properties:
// the background fill applies to the drawing surface (editor view and exported
// images) and the rest select and configure the layout. The layout option keys
// come from the renderer's own schema so the two can never drift apart.
const CYTOSCAPE_DIRECTIVE_BASE_PROPERTIES = [
  BACKGROUND_COLOR_PROPERTY,
  LAYOUT_PROPERTY,
];

const cytoscapeDirectiveCompletionsByLayout: Record<string, Completion[]> =
  Object.fromEntries(
    CYTOSCAPE_LAYOUT_NAMES.map((layoutName) => [
      layoutName,
      buildCompletions([
        ...CYTOSCAPE_DIRECTIVE_BASE_PROPERTIES,
        ...getLayoutOptionKeys(layoutName),
      ]),
    ]),
  );

// Offered when the directive names no layout, or names one that isn't
// recognized. getLayoutName() resolves both of those cases to the default
// layout, so those are the options the block will really accept.
const cytoscapeDirectiveCompletions =
  cytoscapeDirectiveCompletionsByLayout[DEFAULT_CYTOSCAPE_LAYOUT];

interface RendererPropertyEntry {
  all: Completion[];
  byElementType: Record<string, Completion[]>;
  directives: Completion[];
  directivesByLayout?: Record<string, Completion[]>;
}

const rendererPropertyRegistry: Record<string, RendererPropertyEntry> = {
  [CYTOSCAPE_RENDERER_NAME]: {
    all: cytoscapeCompletions,
    byElementType: {
      node: cytoscapeNodeCompletions,
      edge: cytoscapeEdgeCompletions,
      subgraph: cytoscapeNodeCompletions,
    },
    directives: cytoscapeDirectiveCompletions,
    directivesByLayout: cytoscapeDirectiveCompletionsByLayout,
  },
};

export function getRendererPropertyCompletions(
  rendererName: string,
): Completion[] {
  return rendererPropertyRegistry[rendererName]?.all ?? [];
}

export function getRendererPropertyCompletionsByElementType(
  rendererName: string,
  elementType: string,
): Completion[] {
  const entry = rendererPropertyRegistry[rendererName];
  if (!entry) return [];
  return entry.byElementType[elementType] ?? entry.all;
}

/**
 * Directive properties for a renderer, narrowed to a single layout's options
 * when the directive block names one. An unrecognized or absent layout falls
 * back to the renderer's default-layout options, matching how the renderer
 * itself resolves the layout name.
 */
export function getRendererDirectiveCompletions(
  rendererName: string,
  layoutName?: string,
): Completion[] {
  const entry = rendererPropertyRegistry[rendererName];
  if (!entry) return [];
  const normalizedLayout = layoutName?.trim().toLowerCase();
  const isKnownLayout = (CYTOSCAPE_LAYOUT_NAMES as readonly string[]).includes(
    normalizedLayout ?? "",
  );
  if (!isKnownLayout) return entry.directives;
  return (
    entry.directivesByLayout?.[normalizedLayout as CyLayoutName] ??
    entry.directives
  );
}
