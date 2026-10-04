// Special properties for styles
export const DESCRIPTION_PROPERTY: string = "description";
export const DESCRIPTION_PREFIX: string = DESCRIPTION_PROPERTY + "-";

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

// About note names
// A note name currently carries no meaning to the compiler and is largely left
// to community projects to interpret for now. This list seeds the editor's
// suggestions after '~' with the names a recipe is conventionally expected
// to use. It is currently empty, but added here for future extensibility.
export const ABOUT_NOTE_NAMES: readonly string[] = [];
