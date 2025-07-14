import type { Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
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

export class ErrorReporter {
  private source: Text;

  constructor(text: Text) {
    this.source = text;
  }

  makeErrorMessage(error: Error): string {
    const { from, to } = error.position;
    const startLine = this.source.lineAt(from).number;
    const endLine = this.source.lineAt(to).number;
    const codeSnippet = this.source.sliceString(from, to);
    return `Severity: ${error.severity}
Source: ${error.source}
Message: ${error.message}
Location: ${from}-${to}
Lines: ${startLine}-${endLine}
Code:
${codeSnippet}`;
  }

  makeErrorReport(errors: Error[]): string {
    return errors.map((e) => this.makeErrorMessage(e)).join("\n\n");
  }
}
