import { describe, test, expect, vi, beforeEach } from "vitest";
import { Dag } from "src/compiler/dag";
import { ImportCacher, ImportResolver } from "src/compiler/importCacher";
import { Compiler } from "src/compiler/driver";
import { FIZ_FILE_EXTENSION } from "src/compiler/constants";
import { ErrorCode } from "src/compiler/compilationErrors";
import {
  makeDefaultMockHeader,
  makeMockHeaderWithContentType,
  expectImportError,
} from "./importTestHelpers";

// What the cache remembers, and which locations it refuses before a fetch is
// ever attempted. How one response is judged to be a fiz file belongs to the
// transport and is tested in importFetcher.test.ts. Nothing here compiles a
// dag: the cache holds a parsed recipe, and what an import site builds from
// one is dagFactory's business.

describe("import cacher", () => {
  const packageLocation = `test-package${FIZ_FILE_EXTENSION}`;
  const otherPackageLocation = `other-package${FIZ_FILE_EXTENSION}`;
  const nonFizPackageLocation = "test-package.txt";

  // A root resolver and the cacher behind it. Tests reach for the cacher only
  // where the cache itself is the subject (clearing it, peeking into it).
  function makeCacher(): [ImportCacher, ImportResolver] {
    const importCacher = new ImportCacher();
    return [importCacher, new ImportResolver(importCacher)];
  }

  function mockSourceResponse(source: string) {
    return {
      ok: true,
      headers: makeDefaultMockHeader(),
      text: () => Promise.resolve(source),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should fetch and parse a package from a valid URL", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockSourceResponse("f()"));

    const [, imports] = makeCacher();
    const { ast, parseErrors } = await imports.getImport(packageLocation);

    expect(global.fetch).toHaveBeenCalledWith(
      packageLocation,
      expect.anything(),
    );
    expect(parseErrors).toEqual([]);
    expect(ast.Statements).toHaveLength(1);
  });

  test("should hand the next level down a resolver on the chain", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          mockSourceResponse(url === packageLocation ? "f()" : "g()"),
        ),
      );

    const [, imports] = makeCacher();
    const resolved = await imports.getImport(packageLocation);

    // the chain a resolver carries is private, so the way to see that this
    // package is on it is to ask that resolver for this package: importing
    // what is still being built is the cycle the chain exists to catch
    const error = await expectImportError(
      resolved.resolver.getImport(packageLocation),
      ErrorCode.ImportCircular,
    );
    expect(error.message).toEqual(
      `Circular import detected: ${packageLocation}`,
    );

    // a package that is not on the chain is not a cycle
    await expect(
      resolved.resolver.getImport(otherPackageLocation),
    ).resolves.toBeDefined();
  });

  test("should return error for a non-fiz package location", async () => {
    const [, imports] = makeCacher();
    await expect(imports.getImport(nonFizPackageLocation)).rejects.toThrow(
      `Package '${nonFizPackageLocation}' missing file extension ${FIZ_FILE_EXTENSION}`,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should cache the fetched package", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSourceResponse("package source"));

    const [, imports] = makeCacher();
    await imports.getImport(packageLocation);
    await imports.getImport(packageLocation);
    await imports.getImport(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("should clear the cache", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSourceResponse("package source 1"))
      .mockResolvedValueOnce(mockSourceResponse("package source 2"));

    const [importCacher, imports] = makeCacher();
    await imports.getImport(packageLocation);
    importCacher.clearCache();
    await imports.getImport(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("a failed request should not evict the entry that replaced it", async () => {
    const pendingFetches: Array<{
      resolve: (response: unknown) => void;
      reject: (error: unknown) => void;
    }> = [];
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          pendingFetches.push({ resolve, reject });
        }),
    );
    const [importCacher, imports] = makeCacher();

    // abandon a request mid-flight, then start a fresh one for the same package
    const abandoned = imports.getImport(packageLocation);
    importCacher.clearCache();
    const replacement = imports.getImport(packageLocation);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    pendingFetches[1].resolve(mockSourceResponse("package source"));
    await expect(replacement).resolves.toBeDefined();

    pendingFetches[0].reject(new Error("offline"));
    await expect(abandoned).rejects.toThrow("offline");

    // the abandoned failure must leave the cached success alone, or the next
    // caller pays for a refetch of a package that is sitting right there
    await imports.getImport(packageLocation);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("should not resolve a location naming a prototype member", async () => {
    // a plain-object cache answers 'constructor' or '__proto__' with an
    // inherited member, which is not a recipe at all
    global.fetch = vi.fn();
    const [importCacher, imports] = makeCacher();

    for (const location of ["constructor", "__proto__", "toString"]) {
      await expectImportError(
        imports.getImport(location),
        ErrorCode.ImportMissingExtension,
      );
      await expect(
        importCacher.getCachedAst(location),
      ).resolves.toBeUndefined();
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should hand every caller the one cached parse", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSourceResponse("package source"));
    const [, imports] = makeCacher();

    const first = await imports.getImport(packageLocation);
    const second = await imports.getImport(packageLocation);

    // the ast is shared because a recipe's tree does not depend on who
    // imported it; the dag each site builds from it does, and is not cached
    // (see "import reuse across call sites")
    expect(first.ast).toBe(second.ast);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("should retry after a failed fetch instead of caching it", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(mockSourceResponse("f()"));
    const [, imports] = makeCacher();

    await expect(imports.getImport(packageLocation)).rejects.toThrow("offline");
    const retried = await imports.getImport(packageLocation);
    expect(retried.ast.Statements).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("should code a missing extension and an HTML response", async () => {
    const [, imports] = makeCacher();
    await expectImportError(
      imports.getImport(nonFizPackageLocation),
      ErrorCode.ImportMissingExtension,
    );

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("text/html; charset=utf-8"),
      text: () => Promise.resolve("<html></html>"),
    });
    await expectImportError(
      imports.getImport(packageLocation),
      ErrorCode.ImportHtmlResponse,
    );
  });

  test("should accept a fiz location carrying a query string", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSourceResponse("package source"));
    const [, imports] = makeCacher();
    const versionedLocation = `https://example.com/pkg${FIZ_FILE_EXTENSION}?v=2`;

    await expect(imports.getImport(versionedLocation)).resolves.toBeDefined();
  });

  test("should reject a fragment that only looks like a fiz file", async () => {
    global.fetch = vi.fn();
    const [, imports] = makeCacher();

    for (const location of [
      `https://example.com/index.html#pkg${FIZ_FILE_EXTENSION}`,
      `index.html#pkg${FIZ_FILE_EXTENSION}`,
      `index.html?src=pkg${FIZ_FILE_EXTENSION}`,
    ]) {
      await expectImportError(
        imports.getImport(location),
        ErrorCode.ImportMissingExtension,
      );
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should tolerate whitespace around a fiz location", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockSourceResponse("package source"));
    const [, imports] = makeCacher();

    // fetch strips this itself, so rejecting it for a missing extension would
    // only mislead about a location that does carry one
    await expect(
      imports.getImport(`${packageLocation} `),
    ).resolves.toBeDefined();
  });

  test("should let an unparseable location fail at the fetch", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to parse URL"));
    const [, imports] = makeCacher();

    // the extension check cannot inspect either of these, and reporting a
    // missing extension would describe neither fault: the first carries the
    // extension and the second is not a location at all
    for (const location of [
      `https://example.com:99999/pkg${FIZ_FILE_EXTENSION}`,
      "http://",
    ]) {
      const error = await expectImportError(
        imports.getImport(location),
        ErrorCode.ImportFetchFailed,
      );
      expect(error.message).toContain("Failed to parse URL");
    }
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("should peek at the ast of a fetched package", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockSourceResponse("f()"));
    const [importCacher, imports] = makeCacher();

    const { ast } = await imports.getImport(packageLocation);

    await expect(importCacher.getCachedAst(packageLocation)).resolves.toBe(ast);
    // a peek is a peek: it must not have gone and fetched anything itself
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("should never reject a cache peek", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("offline"));
    const [importCacher, imports] = makeCacher();

    await expect(
      importCacher.getCachedAst(packageLocation),
    ).resolves.toBeUndefined();

    const pending = imports.getImport(packageLocation);
    await expect(pending).rejects.toThrow("offline");
    await expect(
      importCacher.getCachedAst(packageLocation),
    ).resolves.toBeUndefined();
  });
});

function makeMockResponse(recipe: string, valid: boolean = true) {
  return Promise.resolve({
    ok: valid,
    headers: makeDefaultMockHeader(),
    text: () => Promise.resolve(recipe),
  });
}

function makeMockFetchImpl(urlToSrc: Map<string, string>) {
  return (url: string) => {
    const source = urlToSrc.get(url);
    if (source) return makeMockResponse(source);
    return Promise.reject(new Error("Invalid URL"));
  };
}

async function compileDagOnce(source: string): Promise<Dag> {
  const compiler = new Compiler();
  const compilation = await compiler.compileFromSource(source);
  return compilation.DAG;
}

describe("transitive imports", () => {
  test("transitive imports should be cached", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `@ "b.fiz"`],
          ["b.fiz", "f()"],
        ]),
      ),
    );
    const testSource = `@ "a.fiz"`;
    const dag = await compileDagOnce(testSource);
    expect(dag.getChildDags()).toHaveLength(0);
    const nodeList = dag.getNodeList();
    expect(nodeList).toHaveLength(1);
    const dagNode = nodeList[0];
    expect(dagNode.name).toEqual("f");

    expect(dag.UsedImports).toEqual(new Set(["a.fiz", "b.fiz"]));
    expect(global.fetch).toHaveBeenCalledWith("a.fiz", expect.anything());
    expect(global.fetch).toHaveBeenCalledWith("b.fiz", expect.anything());
  });

  test("self imports should not cause infinite loop", async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(
        makeMockFetchImpl(new Map([["a.fiz", `@ "a.fiz"`]])),
      );

    const testSource = `@ "a.fiz"`;
    const dag = await compileDagOnce(testSource);
    expect(dag.getChildDags()).toHaveLength(0);
    expect(dag.getNodeList()).toHaveLength(0);

    expect(dag.UsedImports).toEqual(new Set(["a.fiz"]));
    expect(global.fetch).toHaveBeenCalledWith("a.fiz", expect.anything());
  });

  test("circular imports should not cause infinite loop", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `@ "b.fiz"`],
          ["b.fiz", `@ "a.fiz"`],
        ]),
      ),
    );

    const testSource = `@ "a.fiz"`;
    const dag = await compileDagOnce(testSource);
    expect(dag.getChildDags()).toHaveLength(0);
    expect(dag.getNodeList()).toHaveLength(0);

    expect(dag.UsedImports).toEqual(new Set(["a.fiz", "b.fiz"]));
    expect(global.fetch).toHaveBeenCalledWith("a.fiz", expect.anything());
    expect(global.fetch).toHaveBeenCalledWith("b.fiz", expect.anything());
  });

  test("diamond dependency is not considered a circular import", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `x @ "b.fiz"; y @ "c.fiz";`],
          ["b.fiz", `@ "d.fiz"`],
          ["c.fiz", `@ "d.fiz"`],
          ["d.fiz", "f()"],
        ]),
      ),
    );

    const testSource = `@ "a.fiz"`;
    const dag = await compileDagOnce(testSource);
    expect(dag.getChildDags()).toHaveLength(2);

    expect(dag.UsedImports).toEqual(new Set(["a.fiz", "b.fiz", "c.fiz"]));
    expect(global.fetch).toHaveBeenCalledWith("a.fiz", expect.anything());
    expect(global.fetch).toHaveBeenCalledWith("b.fiz", expect.anything());
    expect(global.fetch).toHaveBeenCalledWith("c.fiz", expect.anything());
    expect(global.fetch).toHaveBeenCalledWith("d.fiz", expect.anything());
  });
});

describe("dependency analysis utilities", () => {
  test("empty package location", async () => {
    const compiler = new Compiler();
    const importTree = await compiler.ImportCacher.getDependencyTree("");
    expect(importTree).toEqual(new Map());
  });
  test("transitive imports", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `@ "b.fiz"`],
          ["b.fiz", "f()"],
        ]),
      ),
    );
    const compiler = new Compiler();
    const importTree = await compiler.ImportCacher.getDependencyTree("a.fiz");
    expect(importTree).toEqual(
      new Map([
        ["a.fiz", new Set(["b.fiz"])],
        ["b.fiz", new Set()],
      ]),
    );
  });
  test("circular imports", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `@ "b.fiz"`],
          ["b.fiz", `@ "a.fiz"`],
        ]),
      ),
    );
    const compiler = new Compiler();
    const importTree = await compiler.ImportCacher.getDependencyTree("a.fiz");
    expect(importTree).toEqual(
      new Map([
        ["a.fiz", new Set(["b.fiz"])],
        ["b.fiz", new Set(["a.fiz"])],
      ]),
    );
  });
  test("a package importing itself", async () => {
    // the shortest cycle there is: the walk re-enters the package it is
    // already recording
    global.fetch = vi
      .fn()
      .mockImplementation(makeMockFetchImpl(new Map([["a.fiz", `@ "a.fiz"`]])));
    const compiler = new Compiler();
    const importTree = await compiler.ImportCacher.getDependencyTree("a.fiz");
    expect(importTree).toEqual(new Map([["a.fiz", new Set(["a.fiz"])]]));
  });
  test("a cycle longer than one hop", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `@ "b.fiz"`],
          ["b.fiz", `@ "c.fiz"`],
          ["c.fiz", `@ "a.fiz"`],
        ]),
      ),
    );
    const compiler = new Compiler();
    const importTree = await compiler.ImportCacher.getDependencyTree("a.fiz");
    expect(importTree).toEqual(
      new Map([
        ["a.fiz", new Set(["b.fiz"])],
        ["b.fiz", new Set(["c.fiz"])],
        ["c.fiz", new Set(["a.fiz"])],
      ]),
    );
  });
  test("flattened diamond dependencies", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `x @ "b.fiz"; y @ "c.fiz";`],
          ["b.fiz", `@ "d.fiz"`],
          ["c.fiz", `@ "d.fiz"`],
          ["d.fiz", "f()"],
        ]),
      ),
    );
    const compiler = new Compiler();
    const importer = compiler.ImportCacher;
    const importSet = await importer.getFlatDependencyList("a.fiz");
    expect(importSet).toEqual(new Set(["b.fiz", "c.fiz", "d.fiz"]));
  });
});

function nodeNames(dag: Dag): Set<string> {
  return new Set(dag.getNodeList().map((node) => node.name));
}

// Every id in a dag tree, including the child dags' own. A renderer flattens
// the tree into one element list (makeCyElements), so an id repeated anywhere
// below the root is a collision even when the two elements sit in different
// scopes.
function allElementIds(dag: Dag): string[] {
  const ids = [
    ...dag.getNodeList().map((node) => node.id),
    ...dag.getEdgeList().map((edge) => edge.id),
  ];
  for (const childDag of dag.getChildDags()) {
    ids.push(childDag.Id, ...allElementIds(childDag));
  }
  return ids;
}

function expectUniqueIds(dag: Dag): void {
  const ids = allElementIds(dag);
  expect(new Set(ids)).toHaveLength(ids.length);
}

describe("import reuse across call sites", () => {
  test("one package merged into two namespaces keeps both subgraphs", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(makeMockFetchImpl(new Map([["p.fiz", "sub[f()]"]])));

    const dag = await compileDagOnce(`ns1[@ "p.fiz"]; ns2[@ "p.fiz"]`);

    const namespaces = dag.getChildDags();
    expect(namespaces).toHaveLength(2);
    for (const namespace of namespaces) {
      // a shared dag instance would be re-parented out of the first namespace
      const importedChildren = namespace.getChildDags();
      expect(importedChildren).toHaveLength(1);
      expect(nodeNames(importedChildren[0])).toEqual(new Set(["f"]));
    }
  });

  test("one package named in two namespaces keeps both subgraphs", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(makeMockFetchImpl(new Map([["p.fiz", "f()"]])));

    const dag = await compileDagOnce(`ns1[x @ "p.fiz"]; ns2[x @ "p.fiz"]`);

    const namespaces = dag.getChildDags();
    expect(namespaces).toHaveLength(2);
    for (const namespace of namespaces) {
      const importedChildren = namespace.getChildDags();
      expect(importedChildren).toHaveLength(1);
      expect(nodeNames(importedChildren[0])).toEqual(new Set(["f"]));
    }
  });

  test("a cycle-truncated package is not reused where there is no cycle", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `@ "b.fiz"; fa()`],
          ["b.fiz", `@ "a.fiz"; fb()`],
        ]),
      ),
    );
    const compiler = new Compiler();

    // compiling 'a' leaves 'b' compiled without 'a', since that import closed
    // the cycle
    const viaA = await compiler.compileFromSource(`@ "a.fiz"`);
    expect(nodeNames(viaA.DAG)).toEqual(new Set(["fa", "fb"]));

    // importing 'b' directly is not a cycle, so it must see 'a' as well
    const viaB = await compiler.compileFromSource(`@ "b.fiz"`);
    expect(nodeNames(viaB.DAG)).toEqual(new Set(["fa", "fb"]));

    // recompiled, but the parsed recipe is still cached
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

// An imported package's contents are built under a scope belonging to the
// import site. Before that, they were built under their own root and only the
// imported dag's own id was rewritten, so every site importing one package
// emitted the same ids for its contents.
describe("imported ids are scoped to the import site", () => {
  test("a merged import keeps a node a local call shares a name with", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(makeMockFetchImpl(new Map([["p.fiz", "f()"]])));

    const dag = await compileDagOnce(`f()\n@ "p.fiz"`);

    // both calls were keyed 'root-n-f-0', so the merge overwrote one outright
    expect(dag.getNodeList()).toHaveLength(2);
    expectUniqueIds(dag);
  });

  test("a named import does not collide with a local call", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(makeMockFetchImpl(new Map([["p.fiz", "f()"]])));

    const dag = await compileDagOnce(`f()\nx @ "p.fiz"`);

    expectUniqueIds(dag);
  });

  test("two sites importing one package keep their own ids", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(
        makeMockFetchImpl(new Map([["p.fiz", `a()\nb(a())`]])),
      );

    const dag = await compileDagOnce(`x @ "p.fiz"\ny @ "p.fiz"`);

    // edges as well as nodes: the package declares one of each
    expectUniqueIds(dag);
    const [first, second] = dag.getChildDags();
    expect(nodeNames(first)).toEqual(new Set(["a", "b"]));
    expect(nodeNames(second)).toEqual(new Set(["a", "b"]));
    // separate dags, not one instance handed out twice
    expect(first).not.toBe(second);
  });

  test("an imported id carries its import scope path", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(makeMockFetchImpl(new Map([["p.fiz", "f()"]])));

    const dag = await compileDagOnce(`x @ "p.fiz"`);

    const [imported] = dag.getChildDags();
    expect(imported.Id).toEqual("root-i-x-0");
    expect(imported.getNodeList().map((node) => node.id)).toEqual([
      "root-i-x-0-n-f-0",
    ]);
  });
});

describe("imported error reporting", () => {
  test("a circular import reports its message", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(makeMockFetchImpl(new Map([["a.fiz", `@ "a.fiz"`]])));

    const compilation = await new Compiler().compileFromSource(`@ "a.fiz"`);

    expect(compilation.Errors).toHaveLength(1);
    const [error] = compilation.Errors;
    expect(error.message).toContain("Circular import detected: a.fiz");
    expect(error.message).not.toContain("undefined");
    expect(error.source).toEqual("Import");
  });

  test("errors inside an imported package are surfaced on the import", async () => {
    global.fetch = vi
      .fn()
      .mockImplementation(makeMockFetchImpl(new Map([["p.fiz", "f(x)"]])));

    const source = `@ "p.fiz"`;
    const compilation = await new Compiler().compileFromSource(source);

    expect(compilation.Errors).toHaveLength(1);
    const [error] = compilation.Errors;
    expect(error.message).toContain(
      "Imported package 'p.fiz' reported 1 issue(s)",
    );
    expect(error.severity).toEqual("warning");
    expect(error.source).toEqual("Import");
    // positioned on the import statement, not at the imported file's offsets
    expect(error.position.to).toBeLessThanOrEqual(source.length);
  });
});

describe("dependency walk", () => {
  test("a shared dependency is visited once per package", async () => {
    global.fetch = vi.fn().mockImplementation(
      makeMockFetchImpl(
        new Map([
          ["a.fiz", `x @ "b.fiz"; y @ "c.fiz"`],
          ["b.fiz", `x @ "d.fiz"; y @ "e.fiz"`],
          ["c.fiz", `x @ "d.fiz"; y @ "e.fiz"`],
          ["d.fiz", `@ "f.fiz"`],
          ["e.fiz", `@ "f.fiz"`],
          ["f.fiz", "g()"],
        ]),
      ),
    );
    const compiler = new Compiler();
    // prime the cache so the walk itself is all that gets measured
    await compiler.compileFromSource(`@ "a.fiz"`);

    const importer = compiler.ImportCacher;
    const lookups = vi.spyOn(importer, "getParsedRecipe");
    const tree = await importer.getDependencyTree("a.fiz");

    expect(Array.from(tree.keys()).sort()).toEqual([
      "a.fiz",
      "b.fiz",
      "c.fiz",
      "d.fiz",
      "e.fiz",
      "f.fiz",
    ]);
    // once per package, not once per path to it
    expect(lookups).toHaveBeenCalledTimes(6);
  });
});
