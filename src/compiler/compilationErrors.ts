export interface Position {
  from: number;
  to: number;
}

export interface CompilationError {
  position: Position;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  source: string;
}
