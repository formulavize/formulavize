import { describe, test, expect } from "vitest";
import { dumpImportTree } from "src/compiler/importUtility";
import {
  RecipeTreeNode as Recipe,
  ImportTreeNode as Import,
} from "src/compiler/ast";
import { Compilation } from "src/compiler/compilation";
import { Dag } from "src/compiler/dag";

// Builds a mock CompilationCacher from a map of path → list of direct imports.
// Paths in `rejectedPaths` simulate a failed cache lookup (e.g. fetch error).
// Paths absent from `deps` simulate a cache miss (never fetched).
function makeCacher(
  deps: Map<string, string[]>,
  rejectedPaths: Set<string> = new Set(),
) {
  return {
    getCachedCompilation: (path: string): Promise<Compilation | undefined> => {
      if (rejectedPaths.has(path))
        return Promise.reject(new Error("fetch error"));
      const imports = deps.get(path);
      if (imports === undefined) return Promise.resolve(undefined);
      const ast = new Recipe(imports.map((imp) => new Import(imp)));
      return Promise.resolve(new Compilation("", ast, new Dag(""), []));
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

  test("single import with rejected cache lookup shows url only", async () => {
    const recipe = new Recipe([new Import("a.fiz")]);
    const result = await dumpImportTree(
      makeCacher(new Map(), new Set(["a.fiz"])),
      recipe,
    );
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
