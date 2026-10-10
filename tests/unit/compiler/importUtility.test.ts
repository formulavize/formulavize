import { describe, test, expect } from "vitest";
import { dumpImportTree } from "src/compiler/importUtility";
import {
  RecipeTreeNode as Recipe,
  ImportTreeNode as Import,
} from "src/compiler/ast";

// Builds a mock AstCacher from a map of path → list of direct imports. A path
// absent from `deps` resolves to undefined, which is how the peek reports both
// a cache miss (never fetched) and an import that failed to compile.
function makeCacher(deps: Map<string, string[]>) {
  return {
    getCachedAst: (path: string): Promise<Recipe | undefined> => {
      const imports = deps.get(path);
      if (imports === undefined) return Promise.resolve(undefined);
      return Promise.resolve(new Recipe(imports.map((imp) => new Import(imp))));
    },
  };
}

describe("dumpImportTree", () => {
  test("no imports returns '(no imports)'", async () => {
    const result = await dumpImportTree(makeCacher(new Map()), new Recipe());
    expect(result).toBe("(no imports)");
  });

  test("single import not in cache shows url only", async () => {
    const recipe = new Recipe([new Import("a.fiz")]);
    const result = await dumpImportTree(makeCacher(new Map()), recipe);
    expect(result).toBe("a.fiz");
  });

  test("single cached import with no transitive imports", async () => {
    const recipe = new Recipe([new Import("a.fiz")]);
    const result = await dumpImportTree(
      makeCacher(new Map([["a.fiz", []]])),
      recipe,
    );
    expect(result).toBe("a.fiz");
  });

  test("two cached top-level imports with no transitive imports", async () => {
    const recipe = new Recipe([new Import("a.fiz"), new Import("b.fiz")]);
    const result = await dumpImportTree(
      makeCacher(
        new Map([
          ["a.fiz", []],
          ["b.fiz", []],
        ]),
      ),
      recipe,
    );
    expect(result).toBe("a.fiz\nb.fiz");
  });

  test("single import with one transitive import", async () => {
    // a.fiz → b.fiz
    const recipe = new Recipe([new Import("a.fiz")]);
    const result = await dumpImportTree(
      makeCacher(
        new Map([
          ["a.fiz", ["b.fiz"]],
          ["b.fiz", []],
        ]),
      ),
      recipe,
    );
    expect(result).toBe("a.fiz\n\tb.fiz");
  });

  test("linear chain of three imports", async () => {
    // a.fiz → b.fiz → c.fiz
    const recipe = new Recipe([new Import("a.fiz")]);
    const result = await dumpImportTree(
      makeCacher(
        new Map([
          ["a.fiz", ["b.fiz"]],
          ["b.fiz", ["c.fiz"]],
          ["c.fiz", []],
        ]),
      ),
      recipe,
    );
    expect(result).toBe("a.fiz\n\tb.fiz\n\t\tc.fiz");
  });

  test("cyclic import shows *cyclic dependency* marker", async () => {
    // a.fiz → b.fiz → a.fiz (cycle)
    const recipe = new Recipe([new Import("a.fiz")]);
    const result = await dumpImportTree(
      makeCacher(
        new Map([
          ["a.fiz", ["b.fiz"]],
          ["b.fiz", ["a.fiz"]],
        ]),
      ),
      recipe,
    );
    expect(result).toBe("a.fiz\n\tb.fiz\n\t\ta.fiz\n\t\t\t*cyclic dependency*");
  });

  test("self-import shows *cyclic dependency* marker", async () => {
    // a.fiz → a.fiz
    const recipe = new Recipe([new Import("a.fiz")]);
    const result = await dumpImportTree(
      makeCacher(new Map([["a.fiz", ["a.fiz"]]])),
      recipe,
    );
    expect(result).toBe("a.fiz\n\ta.fiz\n\t\t*cyclic dependency*");
  });

  test("diamond dependency shows shared import under each parent without cyclic marker", async () => {
    // a.fiz → b.fiz → d.fiz
    //       → c.fiz → d.fiz
    const recipe = new Recipe([new Import("a.fiz")]);
    const result = await dumpImportTree(
      makeCacher(
        new Map([
          ["a.fiz", ["b.fiz", "c.fiz"]],
          ["b.fiz", ["d.fiz"]],
          ["c.fiz", ["d.fiz"]],
          ["d.fiz", []],
        ]),
      ),
      recipe,
    );
    expect(result).toBe("a.fiz\n\tb.fiz\n\t\td.fiz\n\tc.fiz\n\t\td.fiz");
  });
});
