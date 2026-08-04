import { describe, expect, test } from "vitest";
import { Text } from "@codemirror/state";
import { fizLanguage } from "@formulavize/lang-fiz";
import { collectRecoverySyntaxErrors } from "src/compiler/syntaxChecks";
import {
  ErrorCode,
  ErrorSource,
  type CompilationError,
} from "src/compiler/compilationErrors";

function collectBracketErrors(source: string): CompilationError[] {
  const tree = fizLanguage.parser.parse(source);
  const errors: CompilationError[] = [];
  collectRecoverySyntaxErrors(tree.cursor(), Text.of([source]), errors);
  return errors;
}

describe("collectRecoverySyntaxErrors", () => {
  test("reports an unclosed opening bracket", () => {
    const errors = collectBracketErrors("f(x");

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Unclosed bracket '('",
      source: ErrorSource.Syntax,
      code: ErrorCode.MismatchedBracket,
    });
  });

  test("reports a mismatched bracket", () => {
    const errors = collectBracketErrors("f(x]");

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Mismatched bracket ']'",
      source: ErrorSource.Syntax,
      code: ErrorCode.MismatchedBracket,
    });
  });

  test("reports an unexpected closing bracket", () => {
    const errors = collectBracketErrors("f}");

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Unexpected closing bracket '}'",
      source: ErrorSource.Syntax,
      code: ErrorCode.MismatchedBracket,
    });
  });

  test("does not report bracket syntax errors for balanced input", () => {
    const errors = collectBracketErrors("f([x])");

    expect(errors).toHaveLength(0);
  });
});
