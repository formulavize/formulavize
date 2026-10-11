import { describe, test, expect } from "vitest";
import {
  getDeclaredImports,
  getImportsFromRecipe,
} from "src/compiler/astUtility";
import {
  RecipeTreeNode as Recipe,
  ImportTreeNode as Import,
  AssignmentTreeNode as Assignment,
  LocalVarTreeNode as LocalVariable,
  NamespaceTreeNode as Namespace,
  StatementListTreeNode as StatementList,
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
      new Namespace(
        "n",
        new StatementList([
          new Import("moduleB"),
          new Assignment([new LocalVariable("x")], new Import("moduleC")),
        ]),
      ),
    ]);
    const imports = getImportsFromRecipe(recipe);
    const expectedImports = new Set(["moduleA", "moduleB", "moduleC"]);
    expect(imports).toEqual(expectedImports);
  });
});

describe("getDeclaredImports", () => {
  test("no statements", () => {
    expect(getDeclaredImports([])).toEqual([]);
  });

  test("a bare import statement is not assigned", () => {
    const declared = getDeclaredImports([new Import("moduleA")]);
    expect(declared).toHaveLength(1);
    expect(declared[0].node.ImportLocation).toBe("moduleA");
    expect(declared[0].isAssigned).toBe(false);
  });

  test("an import on an assignment rhs is assigned", () => {
    const declared = getDeclaredImports([
      new Assignment([new LocalVariable("x")], new Import("moduleA", "Alias")),
    ]);
    expect(declared).toHaveLength(1);
    expect(declared[0].node.ImportLocation).toBe("moduleA");
    expect(declared[0].node.ImportName).toBe("Alias");
    expect(declared[0].isAssigned).toBe(true);
  });

  test("an assignment with a non-import rhs declares nothing", () => {
    const declared = getDeclaredImports([
      new Assignment([new LocalVariable("x")], null),
    ]);
    expect(declared).toEqual([]);
  });

  test("keeps the order the statements declare them in", () => {
    const declared = getDeclaredImports([
      new Import("moduleA"),
      new Assignment([new LocalVariable("x")], new Import("moduleB")),
      new Import("moduleC"),
    ]);
    expect(declared.map(({ node }) => node.ImportLocation)).toEqual([
      "moduleA",
      "moduleB",
      "moduleC",
    ]);
  });

  test("a namespace's imports belong to its own scope", () => {
    // the namespace is a scope of its own, so a caller that wants its imports
    // walks into it rather than finding them hoisted to this level
    const declared = getDeclaredImports([
      new Import("moduleA"),
      new Namespace("n", new StatementList([new Import("moduleB")])),
    ]);
    expect(declared.map(({ node }) => node.ImportLocation)).toEqual([
      "moduleA",
    ]);
  });
});
