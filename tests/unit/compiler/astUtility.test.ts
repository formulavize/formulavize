import { describe, test, expect } from "vitest";
import { getImportsFromRecipe } from "src/compiler/astUtility";
import {
  RecipeTreeNode as Recipe,
  ImportTreeNode as Import,
  AssignmentTreeNode as Assignment,
  LocalVarTreeNode as LocalVariable,
  NamespaceTreeNode as Namespace,
} from "src/compiler/ast";

describe("getImportsFromRecipe", () => {
  test("empty recipe", () => {
    const imports = getImportsFromRecipe(new Recipe());
    expect(imports.size).toBe(0);
  });

  test("a single import", () => {
    const recipe = new Recipe([new Import("moduleA")]);
    const imports = getImportsFromRecipe(recipe);
    const expectedImports = new Set(["moduleA"]);
    expect(imports).toEqual(expectedImports);
  });

  test("multiple imports", () => {
    const recipe = new Recipe([new Import("moduleA"), new Import("moduleB")]);
    const imports = getImportsFromRecipe(recipe);
    const expectedImports = new Set(["moduleA", "moduleB"]);
    expect(imports).toEqual(expectedImports);
  });

  test("import in assignment statement", () => {
    const recipe = new Recipe([
      new Assignment([new LocalVariable("x")], new Import("moduleA")),
    ]);
    const imports = getImportsFromRecipe(recipe);
    const expectedImports = new Set(["moduleA"]);
    expect(imports).toEqual(expectedImports);
  });

  test("import in nested namespace", () => {
    const recipe = new Recipe([
      new Import("moduleA"),
      new Namespace("n", [
        new Import("moduleB"),
        new Assignment([new LocalVariable("x")], new Import("moduleC")),
      ]),
    ]);
    const imports = getImportsFromRecipe(recipe);
    const expectedImports = new Set(["moduleA", "moduleB", "moduleC"]);
    expect(imports).toEqual(expectedImports);
  });
});
