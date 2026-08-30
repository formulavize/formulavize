/**
 * File formats a renderer can export to.
 *
 * The built-in format names are the ones the app ships with, but the type is an
 * open union: a renderer is free to declare a format of its own and handle it
 * in its own export path. Consumers should treat an unrecognized format as a
 * runtime possibility rather than a type error.
 */
export const ExportFormat = {
  PNG: "png",
  JPG: "jpg",
  SVG: "svg",
  TXT: "txt",
} as const;

export type BuiltInExportFormat =
  (typeof ExportFormat)[keyof typeof ExportFormat];

// The `string & {}` arm keeps editor completion for the built-in names while
// still accepting any other string.
export type ExportFormat = BuiltInExportFormat | (string & {});
