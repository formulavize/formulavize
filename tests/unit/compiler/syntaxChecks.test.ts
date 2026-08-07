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
  return errors.filter((error) => error.code === ErrorCode.MismatchedBracket);
}

function collectSyntaxErrors(source: string): CompilationError[] {
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

  test("highlights the unclosed bracket when unexpected token exists", () => {
    const source = "x = @(";
    const errors = collectBracketErrors(source);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "Unclosed bracket '('",
      source: ErrorSource.Syntax,
      code: ErrorCode.MismatchedBracket,
    });
    expect(errors[0]?.position).toEqual({ from: 5, to: 6 });
  });

  test("reports multiple bracket problems in one source", () => {
    const source = "([)]{";
    const errors = collectBracketErrors(source);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "Mismatched bracket ')'" }),
        expect.objectContaining({ message: "Mismatched bracket ']'" }),
        expect.objectContaining({ message: "Unclosed bracket '{'" }),
      ]),
    );
  });

  test("does not report bracket syntax errors for balanced input", () => {
    const errors = collectBracketErrors("f([x])");

    expect(errors).toHaveLength(0);
  });

  test("reports unexpected token recovery errors", () => {
    const errors = collectSyntaxErrors("f([x])");

    expect(errors).toContainEqual(
      expect.objectContaining({
        message: "Unexpected token '['",
        source: ErrorSource.Syntax,
        code: ErrorCode.UnexpectedToken,
      }),
    );
  });

  test("suppresses unexpected token when bracket error exists at same span", () => {
    const errors = collectSyntaxErrors("x = @(");

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Unclosed bracket '('",
          code: ErrorCode.MismatchedBracket,
          position: { from: 5, to: 6 },
        }),
      ]),
    );

    const unexpectedAtBracketPosition = errors.find(
      (error) =>
        error.message.startsWith("Unexpected token") &&
        error.position.from === 5 &&
        error.position.to === 6,
    );
    expect(unexpectedAtBracketPosition).toBeUndefined();
  });

  test("keeps unexpected token errors at different spans from bracket errors", () => {
    const errors = collectSyntaxErrors("f([x])");

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Unexpected token '['",
          source: ErrorSource.Syntax,
          code: ErrorCode.UnexpectedToken,
        }),
      ]),
    );
  });
});
