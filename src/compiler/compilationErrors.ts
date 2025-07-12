export interface Position {
  from: number;
  to: number;
}

export const DEFAULT_POSITION: Position = { from: 0, to: 0 };

export interface CompilationError {
  position: Position;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  source: string;
}
