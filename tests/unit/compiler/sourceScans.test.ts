import { describe, expect } from "vitest";
import { ErrorSource } from "src/compiler/compilationErrors";
import { Compiler } from "src/compiler/driver";
import { test } from "vitest";

describe("source scans", () => {
  test("reports unmatched opening bracket as a syntax error", async () => {
    const sourceRecipe = "f(x";

    const compiler = new Compiler();
    const compilation = await compiler.compileFromSource(sourceRecipe);

    expect(compilation.Errors).toHaveLength(1);
    expect(compilation.Errors[0]).toMatchObject({
      source: ErrorSource.Syntax,
      message: "Unclosed bracket '('",
      severity: "error",
    });
  });
});
