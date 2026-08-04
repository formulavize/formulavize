import { Text } from "@codemirror/state";
import { TreeCursor } from "@lezer/common";
import {
  CompilationError as Error,
  ErrorCode,
  ErrorSource,
  Position,
} from "./compilationErrors";

function getPosition(c: TreeCursor): Position {
  return { from: c.from, to: c.to };
}

function makeBracketError(c: TreeCursor, errorMsg: string): Error {
  return {
    position: getPosition(c),
    message: errorMsg,
    severity: "error",
    source: ErrorSource.Syntax,
    code: ErrorCode.MismatchedBracket,
  };
}

function addRecoverySyntaxError(
  c: TreeCursor,
  text: Text,
  errors: Error[],
): boolean {
  if (errors.some((error) => error.code === ErrorCode.MismatchedBracket)) {
    return true;
  }

  if (c.name !== "⚠") return false;

  const sourceText = text.toString();
  const stack: Array<{ char: string; from: number }> = [];

  for (let index = 0; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (char === "(" || char === "{" || char === "[") {
      stack.push({ char, from: index });
      continue;
    }

    if (char === ")" || char === "}" || char === "]") {
      const matchingBracket = char === ")" ? "(" : char === "}" ? "{" : "[";
      const opener = stack[stack.length - 1];
      if (!opener) {
        errors.push(
          makeBracketError(c, `Unexpected closing bracket '${char}'`),
        );
        return true;
      }

      if (opener.char !== matchingBracket) {
        errors.push(makeBracketError(c, `Mismatched bracket '${char}'`));
        stack.pop();
        return true;
      }

      stack.pop();
    }
  }

  if (stack.length > 0) {
    const opener = stack[stack.length - 1];
    errors.push(makeBracketError(c, `Unclosed bracket '${opener.char}'`));
    return true;
  }

  return false;
}

export function collectRecoverySyntaxErrors(
  c: TreeCursor,
  text: Text,
  errors: Error[],
): void {
  if (addRecoverySyntaxError(c, text, errors)) return;

  if (c.firstChild()) {
    do {
      collectRecoverySyntaxErrors(c, text, errors);
    } while (c.nextSibling());
    c.parent();
  }
}
