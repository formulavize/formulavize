import { describe, test, expect, vi, beforeEach } from "vitest";
import { Dag } from "../../../src/compiler/dag";
import { ImportCacher } from "../../../src/compiler/importCacher";
import { Compiler } from "../../../src/compiler/driver";
import { FIZ_FILE_EXTENSION } from "../../../src/compiler/constants";

describe("import cacher", () => {
  const mockDag = {};
  const mockCompiler = {
    compile: vi.fn().mockReturnValue({ DAG: mockDag }),
  } as unknown as Compiler.Driver;

  const packageLocation = `test-package${FIZ_FILE_EXTENSION}`;
  const nonFizPackageLocation = "test-package.txt";
  const invalidPackageLocation = "invalid.fiz";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should fetch a package from a valid URL", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("package source"),
    });

    const importCacher = new ImportCacher(mockCompiler);
    const result = await importCacher.getPackageDag(packageLocation);

    expect(global.fetch).toHaveBeenCalledWith(packageLocation);
    expect(mockCompiler.compile).toHaveBeenCalledWith(
      "package source",
      expect.any(Function),
      expect.any(Function),
      new Set([packageLocation]),
    );
    expect(result).toEqual(mockDag);
  });

  test("should return error for an invalid package location", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve("failure"),
    });

    const importCacher = new ImportCacher(mockCompiler);
    await expect(
      importCacher.getPackageDag(invalidPackageLocation),
    ).rejects.toThrow(
      `Failed to fetch package from '${invalidPackageLocation}'`,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("should return error for a non-fiz package location", async () => {
    const importCacher = new ImportCacher(mockCompiler);
    await expect(
      importCacher.getPackageDag(nonFizPackageLocation),
    ).rejects.toThrow(
      `Package '${nonFizPackageLocation}' missing file extension ${FIZ_FILE_EXTENSION}`,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should cache the fetched package", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("package source"),
    });

    const importCacher = new ImportCacher(mockCompiler);
    await importCacher.getPackageDag(packageLocation);
    const result = await importCacher.getPackageDag(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockDag);

    const cachedResult = await importCacher.getPackageDag(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(cachedResult).toEqual(mockDag);
  });

  test("should clear the cache", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("package source 1"),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("package source 2"),
      });

    const importCacher = new ImportCacher(mockCompiler);
    await importCacher.getPackageDag(packageLocation);
    importCacher.clearCache();
    await importCacher.getPackageDag(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("should throw an error if fetch status unsuccessful", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    });
    const importCacher = new ImportCacher(mockCompiler);

    await expect(importCacher.getPackageDag(packageLocation)).rejects.toThrow(
      "Failed to fetch package from 'test-package.fiz': Not Found",
    );
  });

  test("should throw an error if fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch"));
    const importCacher = new ImportCacher(mockCompiler);

    await expect(importCacher.getPackageDag(packageLocation)).rejects.toThrow(
      "Failed to fetch",
    );
  });
});

function makeMockResponse(recipe: string, valid: boolean = true) {
  return Promise.resolve({
    ok: valid,
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

async function compileDag(
  source: string,
  compiler: Compiler.Driver,
): Promise<Dag> {
  const sourceGen = Compiler.sourceFromSource;
  const parser = Compiler.parseFromSource;
  const compilation = await compiler.compile(source, sourceGen, parser);
  return compilation.DAG;
}

async function compileDagOnce(source: string): Promise<Dag> {
  const compiler = new Compiler.Driver();
  return compileDag(source, compiler);
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

    expect(global.fetch).toHaveBeenCalledWith("a.fiz");
    expect(global.fetch).toHaveBeenCalledWith("b.fiz");
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

    expect(global.fetch).toHaveBeenCalledWith("a.fiz");
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

    expect(global.fetch).toHaveBeenCalledWith("a.fiz");
    expect(global.fetch).toHaveBeenCalledWith("b.fiz");
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

    expect(global.fetch).toHaveBeenCalledWith("a.fiz");
    expect(global.fetch).toHaveBeenCalledWith("b.fiz");
    expect(global.fetch).toHaveBeenCalledWith("c.fiz");
    expect(global.fetch).toHaveBeenCalledWith("d.fiz");
  });
});

describe("dependency analysis utilities", () => {
  test("empty package location", async () => {
    const compiler = new Compiler.Driver();
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
    const compiler = new Compiler.Driver();
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
    const compiler = new Compiler.Driver();
    const importTree = await compiler.ImportCacher.getDependencyTree("a.fiz");
    expect(importTree).toEqual(
      new Map([
        ["a.fiz", new Set(["b.fiz"])],
        ["b.fiz", new Set(["a.fiz"])],
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
    const compiler = new Compiler.Driver();
    const importer = compiler.ImportCacher;
    const importSet = await importer.getFlatDependencyList("a.fiz");
    expect(importSet).toEqual(new Set(["b.fiz", "c.fiz", "d.fiz"]));
  });
});
