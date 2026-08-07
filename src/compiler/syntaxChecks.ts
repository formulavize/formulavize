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

function makeBracketError(from: number, to: number, errorMsg: string): Error {
  return {
    position: { from, to },
    message: errorMsg,
    severity: "error",
    source: ErrorSource.Syntax,
    code: ErrorCode.MismatchedBracket,
  };
}

function makeUnexpectedTokenError(
  c: TreeCursor,
  unexpectedText: string,
): Error {
  return {
    position: getPosition(c),
    message: `Unexpected token '${unexpectedText}'`,
    severity: "error",
    source: ErrorSource.Syntax,
    code: ErrorCode.UnexpectedToken,
  };
}

function collectBracketErrors(text: Text): Error[] {
  const sourceText = text.toString();
  const stack: Array<{ char: string; from: number }> = [];
  const bracketErrors: Error[] = [];

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
        bracketErrors.push(
          makeBracketError(
            index,
            index + 1,
            `Unexpected closing bracket '${char}'`,
          ),
        );
        continue;
      }

      if (opener.char !== matchingBracket) {
        bracketErrors.push(
          makeBracketError(index, index + 1, `Mismatched bracket '${char}'`),
        );
        stack.pop();
        continue;
      }

      stack.pop();
    }
  }

  while (stack.length > 0) {
    const opener = stack.pop();
    if (!opener) break;
    bracketErrors.push(
      makeBracketError(
        opener.from,
        opener.from + 1,
        `Unclosed bracket '${opener.char}'`,
      ),
    );
  }

  return bracketErrors;
}

function addRecoverySyntaxError(
  c: TreeCursor,
  text: Text,
  errors: Error[],
): boolean {
  if (c.name !== "⚠") return false;

  if (!errors.some((error) => error.code === ErrorCode.MismatchedBracket)) {
    errors.push(...collectBracketErrors(text));
  }

  const unexpectedText = text.sliceString(c.from, c.to).trim();
  if (!unexpectedText) return false;

  const hasBracketErrorAtSpan = errors.some(
    (error) =>
      error.code === ErrorCode.MismatchedBracket &&
      error.position.from === c.from &&
      error.position.to === c.to,
  );
  if (hasBracketErrorAtSpan) return true;

  errors.push(makeUnexpectedTokenError(c, unexpectedText));
  return true;
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
