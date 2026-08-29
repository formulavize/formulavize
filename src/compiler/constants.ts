// Special properties for styles
export const DESCRIPTION_PROPERTY: string = "description";
export const DESCRIPTION_PREFIX: string = DESCRIPTION_PROPERTY + "-";
export const BACKGROUND_COLOR_PROPERTY: string = "background-color";

// Renderer directive property selecting which cytoscape layout runs. The
// options each layout accepts are named by its own provider (see
// renderers/cyDag/layouts) rather than declared here, so a layout can be added
// without touching the compiler.
export const LAYOUT_PROPERTY: string = "layout";

// Layouts selectable with '^cytoscape{ layout: "<name>" }'. All but 'manual'
// are hierarchical layouts that position every node automatically.
// https://blog.js.cytoscape.org/2020/05/11/layouts/#hierarchical-layouts
export const CYTOSCAPE_LAYOUT_NAMES = [
  "dagre",
  "breadthfirst",
  "elk",
  "manual",
] as const;
export const DEFAULT_CYTOSCAPE_LAYOUT = "dagre";

// 'manual' is not a layout algorithm: it turns the layout manager off and hands
// node placement to the user, who drags nodes around in the rendered graph.
export const MANUAL_CYTOSCAPE_LAYOUT = "manual";

// Renderer names. These are the identifiers usable in a '^<rendererName>{ }'
// directive and the keys used by useRendererRegistry and
// rendererPropertyRegistry. Keeping them here keeps that agreement typed.
export const CYTOSCAPE_RENDERER_NAME: string = "cytoscape";
export const MINIMAL_RENDERER_NAME: string = "minimal";
export const RENDERER_NAMES: readonly string[] = [
  CYTOSCAPE_RENDERER_NAME,
  MINIMAL_RENDERER_NAME,
];

// Import constants
export const FIZ_FILE_EXTENSION: string = ".fiz";

// Global style binding keywords
// Maps multilingual keywords to canonical element types
// ("node", "edge", or "subgraph")
// Every keyword here must have a selector in the renderer's selector map:
// '*' means "becomes a renderer selector". Concerns that the renderer consumes
// directly belong in a '^<rendererName>{ }' directive instead.
export const GLOBAL_STYLE_KEYWORD_MAP: Map<string, string> = new Map([
  ["node", "node"],
  ["edge", "edge"],
  ["subgraph", "subgraph"],
]);

// Image export formats
export enum ExportFormat {
  PNG = "png",
  JPG = "jpg",
  SVG = "svg",
  TXT = "txt",
}
