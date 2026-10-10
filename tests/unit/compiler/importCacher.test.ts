import { describe, test, expect, vi, beforeEach } from "vitest";
import { Dag } from "src/compiler/dag";
import {
  ImportCacher,
  ImportError,
  CompileFromSourceFn,
  IMPORT_FETCH_TIMEOUT_MS,
  MAX_IMPORT_BYTES,
} from "src/compiler/importCacher";
import { Compiler } from "src/compiler/driver";
import { FIZ_FILE_EXTENSION } from "src/compiler/constants";
import { ErrorCode } from "src/compiler/compilationErrors";

function makeMockHeaders(entries: Record<string, string>) {
  return {
    get: (key: string) => entries[key.toLowerCase()] ?? null,
  };
}

function makeMockHeaderWithContentType(contentType: string) {
  return makeMockHeaders({ "content-type": contentType });
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (error) => error,
  );
}

async function expectImportError(
  promise: Promise<unknown>,
  code: ErrorCode,
): Promise<ImportError> {
  const error = await captureRejection(promise);
  expect(error).toBeInstanceOf(ImportError);
  const importError = error as ImportError;
  expect(importError.code).toEqual(code);
  return importError;
}

function makeDefaultMockHeader() {
  return makeMockHeaderWithContentType("text/plain");
}

describe("import cacher", () => {
  const mockDag = new Dag("mock-package");
  const mockCompileSourceFn: CompileFromSourceFn = vi
    .fn()
    .mockReturnValue({ DAG: mockDag, Errors: [] });

  const packageLocation = `test-package${FIZ_FILE_EXTENSION}`;
  const nonFizPackageLocation = "test-package.txt";
  const invalidPackageLocation = "invalid.fiz";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should fetch a package from a valid URL", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeDefaultMockHeader(),
      text: () => Promise.resolve("package source"),
    });

    const importCacher = new ImportCacher(mockCompileSourceFn);
    const { DAG } = await importCacher.getPackageCompilation(packageLocation);

    // the signal is what bounds a hung server, so assert it is really attached
    expect(global.fetch).toHaveBeenCalledWith(
      packageLocation,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockCompileSourceFn).toHaveBeenCalledWith(
      "package source",
      new Set([packageLocation]),
    );
    expect(DAG).toEqual(mockDag);
  });

  test("should return error for an invalid package location", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve("failure"),
    });

    const importCacher = new ImportCacher(mockCompileSourceFn);
    await expect(
      importCacher.getPackageCompilation(invalidPackageLocation),
    ).rejects.toThrow(
      `Failed to fetch package from '${invalidPackageLocation}'`,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("should return error for a non-fiz package location", async () => {
    const importCacher = new ImportCacher(mockCompileSourceFn);
    await expect(
      importCacher.getPackageCompilation(nonFizPackageLocation),
    ).rejects.toThrow(
      `Package '${nonFizPackageLocation}' missing file extension ${FIZ_FILE_EXTENSION}`,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should cache the fetched package", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeDefaultMockHeader(),
      text: () => Promise.resolve("package source"),
    });

    const importCacher = new ImportCacher(mockCompileSourceFn);
    await importCacher.getPackageCompilation(packageLocation);
    const result = await importCacher.getPackageCompilation(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.DAG).toEqual(mockDag);

    const cachedResult =
      await importCacher.getPackageCompilation(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(cachedResult.DAG).toEqual(mockDag);
  });

  test("should clear the cache", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: makeDefaultMockHeader(),
        text: () => Promise.resolve("package source 1"),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: makeDefaultMockHeader(),
        text: () => Promise.resolve("package source 2"),
      });

    const importCacher = new ImportCacher(mockCompileSourceFn);
    await importCacher.getPackageCompilation(packageLocation);
    importCacher.clearCache();
    await importCacher.getPackageCompilation(packageLocation);

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
    const importCacher = new ImportCacher(mockCompileSourceFn);

    // abandon a request mid-flight, then start a fresh one for the same package
    const abandoned = importCacher.getPackageCompilation(packageLocation);
    importCacher.clearCache();
    const replacement = importCacher.getPackageCompilation(packageLocation);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    pendingFetches[1].resolve({
      ok: true,
      headers: makeDefaultMockHeader(),
      text: () => Promise.resolve("package source"),
    });
    await expect(replacement).resolves.toBeDefined();

    pendingFetches[0].reject(new Error("offline"));
    await expect(abandoned).rejects.toThrow("offline");

    // the abandoned failure must leave the cached success alone, or the next
    // caller pays for a refetch of a package that is sitting right there
    await importCacher.getPackageCompilation(packageLocation);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("should throw an error if fetch status unsuccessful", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    await expect(
      importCacher.getPackageCompilation(packageLocation),
    ).rejects.toThrow(
      "Failed to fetch package from 'test-package.fiz': Not Found",
    );
  });

  test("should throw an error if fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch"));
    const importCacher = new ImportCacher(mockCompileSourceFn);

    await expect(
      importCacher.getPackageCompilation(packageLocation),
    ).rejects.toThrow("Failed to fetch");
  });

  test("should throw an error if response is HTML", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("text/html; charset=utf-8"),
      text: () => Promise.resolve("<html></html>"),
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    await expect(
      importCacher.getPackageCompilation(packageLocation),
    ).rejects.toThrow(
      `Expected a fiz file but received HTML from '${packageLocation}'`,
    );
  });

  test("should throw an error if response is HTML in any casing", async () => {
    // header values are not case-normalized, and an uppercase media type that
    // escaped this check would still pass the 'text/' allow-list below it
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("TEXT/HTML; charset=UTF-8"),
      text: () => Promise.resolve("<html></html>"),
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    await expectImportError(
      importCacher.getPackageCompilation(packageLocation),
      ErrorCode.ImportHtmlResponse,
    );
  });

  test("should accept an allowed content type in any casing", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("Text/Plain; charset=UTF-8"),
      text: () => Promise.resolve("package source"),
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    const compilation =
      await importCacher.getPackageCompilation(packageLocation);
    expect(compilation.DAG).toBeInstanceOf(Dag);
  });

  test("should not resolve a location naming a prototype member", async () => {
    // a plain-object cache answers 'constructor' or '__proto__' with an
    // inherited member, which is not a compilation at all
    global.fetch = vi.fn();
    const importCacher = new ImportCacher(mockCompileSourceFn);

    for (const location of ["constructor", "__proto__", "toString"]) {
      await expectImportError(
        importCacher.getPackageCompilation(location),
        ErrorCode.ImportMissingExtension,
      );
      await expect(
        importCacher.getCachedCompilation(location),
      ).resolves.toBeUndefined();
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should hand every caller the one cached compilation", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeDefaultMockHeader(),
      text: () => Promise.resolve("package source"),
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    const first = await importCacher.getPackageCompilation(packageLocation);
    const second = await importCacher.getPackageCompilation(packageLocation);

    // the dag handed out is the cached instance, which is why an import site
    // clones it before mutating (see "import reuse across call sites")
    expect(first).toBe(second);
    expect(first.DAG).toBe(second.DAG);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("should retry after a failed fetch instead of caching it", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        headers: makeDefaultMockHeader(),
        text: () => Promise.resolve("package source"),
      });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    await expect(
      importCacher.getPackageCompilation(packageLocation),
    ).rejects.toThrow("offline");
    const retried = await importCacher.getPackageCompilation(packageLocation);
    expect(retried.DAG).toBeInstanceOf(Dag);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("should report a circular import as a coded error", async () => {
    const importCacher = new ImportCacher(mockCompileSourceFn);
    const error = await expectImportError(
      importCacher.getPackageCompilation(
        packageLocation,
        new Set([packageLocation]),
      ),
      ErrorCode.ImportCircular,
    );
    expect(error.message).toEqual(
      `Circular import detected: ${packageLocation}`,
    );
  });

  test("should code a missing extension and an HTML response", async () => {
    const importCacher = new ImportCacher(mockCompileSourceFn);
    await expectImportError(
      importCacher.getPackageCompilation(nonFizPackageLocation),
      ErrorCode.ImportMissingExtension,
    );

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("text/html; charset=utf-8"),
      text: () => Promise.resolve("<html></html>"),
    });
    await expectImportError(
      importCacher.getPackageCompilation(packageLocation),
      ErrorCode.ImportHtmlResponse,
    );
  });

  test("should reject a response that is not text", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("application/json"),
      text: () => Promise.resolve("{}"),
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    const error = await expectImportError(
      importCacher.getPackageCompilation(packageLocation),
      ErrorCode.ImportInvalidContentType,
    );
    expect(error.message).toContain("application/json");
  });

  test("should accept a fiz location carrying a query string", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeDefaultMockHeader(),
      text: () => Promise.resolve("package source"),
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);
    const versionedLocation = `https://example.com/pkg${FIZ_FILE_EXTENSION}?v=2`;

    const compilation =
      await importCacher.getPackageCompilation(versionedLocation);
    expect(compilation.DAG).toBeInstanceOf(Dag);
  });

  test("should reject a fragment that only looks like a fiz file", async () => {
    global.fetch = vi.fn();
    const importCacher = new ImportCacher(mockCompileSourceFn);

    for (const location of [
      `https://example.com/index.html#pkg${FIZ_FILE_EXTENSION}`,
      `index.html#pkg${FIZ_FILE_EXTENSION}`,
      `index.html?src=pkg${FIZ_FILE_EXTENSION}`,
    ]) {
      await expectImportError(
        importCacher.getPackageCompilation(location),
        ErrorCode.ImportMissingExtension,
      );
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should tolerate whitespace around a fiz location", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeDefaultMockHeader(),
      text: () => Promise.resolve("package source"),
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    // fetch strips this itself, so rejecting it for a missing extension would
    // only mislead about a location that does carry one
    const compilation = await importCacher.getPackageCompilation(
      `${packageLocation} `,
    );
    expect(compilation.DAG).toBeInstanceOf(Dag);
  });

  test("should let an unparseable location fail at the fetch", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to parse URL"));
    const importCacher = new ImportCacher(mockCompileSourceFn);

    // the extension check cannot inspect either of these, and reporting a
    // missing extension would describe neither fault: the first carries the
    // extension and the second is not a location at all
    for (const location of [
      `https://example.com:99999/pkg${FIZ_FILE_EXTENSION}`,
      "http://",
    ]) {
      const error = await expectImportError(
        importCacher.getPackageCompilation(location),
        ErrorCode.ImportFetchFailed,
      );
      expect(error.message).toContain("Failed to parse URL");
    }
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("should report a fetch timeout as such", async () => {
    const timeoutError = new Error("This operation was aborted");
    timeoutError.name = "TimeoutError";
    global.fetch = vi.fn().mockRejectedValueOnce(timeoutError);
    const importCacher = new ImportCacher(mockCompileSourceFn);

    const error = await expectImportError(
      importCacher.getPackageCompilation(packageLocation),
      ErrorCode.ImportFetchFailed,
    );
    expect(error.message).toContain(
      `timed out after ${IMPORT_FETCH_TIMEOUT_MS}ms`,
    );
  });

  test("should reject a response larger than the import limit", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaders({
        "content-type": "text/plain",
        "content-length": String(MAX_IMPORT_BYTES + 1),
      }),
      text: () => Promise.resolve("package source"),
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    const error = await expectImportError(
      importCacher.getPackageCompilation(packageLocation),
      ErrorCode.ImportFetchFailed,
    );
    expect(error.message).toContain("import limit");
  });

  test("should report the status when a fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    const importCacher = new ImportCacher(mockCompileSourceFn);

    await expect(
      importCacher.getPackageCompilation(packageLocation),
    ).rejects.toThrow(
      `Failed to fetch package from '${packageLocation}': 404 Not Found`,
    );
  });

  test("should never reject a cache peek", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("offline"));
    const importCacher = new ImportCacher(mockCompileSourceFn);

    await expect(
      importCacher.getCachedCompilation(packageLocation),
    ).resolves.toBeUndefined();

    const pending = importCacher.getPackageCompilation(packageLocation);
    await expect(pending).rejects.toThrow("offline");
    await expect(
      importCacher.getCachedCompilation(packageLocation),
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

    // recompiled, but the fetched source is still cached
    expect(global.fetch).toHaveBeenCalledTimes(2);
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
    const lookups = vi.spyOn(importer, "getPackageCompilation");
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
