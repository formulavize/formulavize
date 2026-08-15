// Special properties for styles
export const DESCRIPTION_PROPERTY: string = "description";
export const DESCRIPTION_PREFIX: string = DESCRIPTION_PROPERTY + "-";
export const BACKGROUND_COLOR_PROPERTY: string = "background-color";

// Renderer directive property consumed by the cytoscape renderer's layout
export const RANK_DIR_PROPERTY: string = "rankDir";

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
