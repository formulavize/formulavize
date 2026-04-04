// Special properties for styles
export const DESCRIPTION_PROPERTY: string = "description";
export const DESCRIPTION_PREFIX: string = DESCRIPTION_PROPERTY + "-";

// Import constants
export const FIZ_FILE_EXTENSION: string = ".fiz";

// Global style binding keywords
// Maps multilingual keywords to canonical element types ("node" or "edge")
export const GLOBAL_STYLE_KEYWORD_MAP: Map<string, string> = new Map([
  ["node", "node"],
  ["edge", "edge"],
]);

// Image export formats
export enum ExportFormat {
  PNG = "png",
  JPG = "jpg",
  SVG = "svg",
  TXT = "txt",
}
