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
  InvalidGlobalStyleKeyword = "SYN_INVALID_GLOBAL_STYLE_KEYWORD",

  // Import errors
  ImportFetchFailed = "IMP_FETCH_FAILED",
  ImportCircular = "IMP_CIRCULAR",
  ImportMissingExtension = "IMP_MISSING_EXTENSION",
  ImportHtmlResponse = "IMP_HTML_RESPONSE",

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
