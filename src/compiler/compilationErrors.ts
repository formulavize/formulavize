export interface Position {
  from: number;
  to: number;
}

export const DEFAULT_POSITION: Position = { from: 0, to: 0 };

export enum ErrorSource {
  Internal = "Internal",
  Syntax = "Syntax",
  Reference = "Reference",
  Import = "Import",
}

export enum ErrorCode {
  // Reference errors
  VariableNotFound = "REF_VAR_NOT_FOUND",
  StyleTagNotFound = "REF_STYLE_TAG_NOT_FOUND",

  // Syntax errors
  MissingLhs = "SYN_MISSING_LHS",
  MissingRhs = "SYN_MISSING_RHS",
  DuplicateLhsName = "SYN_DUPLICATE_LHS_NAME",
  DuplicateStylePropertyName = "SYN_DUPLICATE_STYLE_PROPERTY_NAME",
  MismatchedBracket = "SYN_MISMATCHED_BRACKET",
  UnexpectedToken = "SYN_UNEXPECTED_TOKEN",
  InvalidGlobalStyleKeyword = "SYN_INVALID_GLOBAL_STYLE_KEYWORD",
  RendererDirectiveNotAtTopLevel = "SYN_RENDERER_DIRECTIVE_NOT_TOP_LEVEL",
  AboutNoteNotAtTopLevel = "SYN_ABOUT_NOTE_NOT_TOP_LEVEL",

  // Import errors
  ImportFetchFailed = "IMP_FETCH_FAILED",
  ImportCircular = "IMP_CIRCULAR",
  ImportMissingExtension = "IMP_MISSING_EXTENSION",
  ImportHtmlResponse = "IMP_HTML_RESPONSE",
  ImportInvalidContentType = "IMP_INVALID_CONTENT_TYPE",

  // Internal errors
  UnknownArgumentType = "INT_UNKNOWN_ARG_TYPE",
  InvalidRhsType = "INT_INVALID_RHS_TYPE",
  UnknownStatementType = "INT_UNKNOWN_STMT_TYPE",
}

export interface CompilationError {
  position: Position;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  source: ErrorSource;
  code?: ErrorCode;
}

// The message to report for something thrown by a layer outside the compiler:
// a fetch, a file read, a renderer. An Error carries one, anything else has to
// be stringified.
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
