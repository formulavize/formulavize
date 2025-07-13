import type { Diagnostic } from "@codemirror/lint";
import { CompilationError as Error } from "./compilationErrors";

export function errorToDiagnostic(error: Error): Diagnostic {
  return {
    from: error.position.from,
    to: error.position.to,
    message: error.message,
    severity: error.severity,
    source: error.source,
  };
}
