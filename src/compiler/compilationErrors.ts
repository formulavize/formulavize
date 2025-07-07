export interface CompilationError {
  position: { from: number; to: number };
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  source: string;
}
