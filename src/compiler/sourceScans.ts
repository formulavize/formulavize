import {
  CompilationError as Error,
  ErrorCode,
  ErrorSource,
} from "./compilationErrors";
export { collectBracketMismatchErrors };

function makeBracketSyntaxError(
  from: number,
  to: number,
  message: string,
): Error {
  return {
    position: { from, to },
    message,
    severity: "error",
    source: ErrorSource.Syntax,
    code: ErrorCode.MismatchedBracket,
  };
}

function collectBracketMismatchErrors(source: string): Error[] {
  const bracketStack: Array<{ char: string; from: number }> = [];
  const errors: Error[] = [];
  let inString: string | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === "(" || char === "{" || char === "[") {
      bracketStack.push({ char, from: index });
      continue;
    }

    if (char === ")" || char === "}" || char === "]") {
      const matchingBracket = char === ")" ? "(" : char === "}" ? "{" : "[";
      const opener = bracketStack[bracketStack.length - 1];

      if (!opener) {
        errors.push(
          makeBracketSyntaxError(
            index,
            index + 1,
            `Unexpected closing bracket '${char}'`,
          ),
        );
        continue;
      }

      if (opener.char !== matchingBracket) {
        errors.push(
          makeBracketSyntaxError(
            index,
            index + 1,
            `Mismatched bracket '${char}'`,
          ),
        );
        bracketStack.pop();
        continue;
      }

      bracketStack.pop();
    }
  }

  while (bracketStack.length > 0) {
    const opener = bracketStack.pop()!;
    errors.push(
      makeBracketSyntaxError(
        opener.from,
        opener.from + 1,
        `Unclosed bracket '${opener.char}'`,
      ),
    );
  }

  return errors;
}
