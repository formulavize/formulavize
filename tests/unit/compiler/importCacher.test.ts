import { describe, test, expect, vi, beforeEach } from "vitest";
import { ImportCacher } from "../../../src/compiler/importCacher";
import { Compiler } from "../../../src/compiler/driver";
import { FIZ_FILE_EXTENSION } from "../../../src/compiler/constants";

describe("import cacher", () => {
  const mockDag = {};
  const mockCompiler = {
    compile: vi.fn().mockReturnValue({ DAG: mockDag }),
  } as unknown as Compiler.Driver;

  const packageLocation = `test-package${FIZ_FILE_EXTENSION}`;
  const invalidPackageLocation = "test-package.txt";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should fetch a package from a valid URL", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("package source"),
    });

    const importCacher = new ImportCacher(mockCompiler);
    const result = await importCacher.getPackage(packageLocation);

    expect(global.fetch).toHaveBeenCalledWith(packageLocation);
    expect(mockCompiler.compile).toHaveBeenCalledWith(
      "package source",
      expect.any(Function),
      expect.any(Function),
    );
    expect(result).toEqual(mockDag);
  });

  test("should return error for an invalid package location", async () => {
    const importCacher = new ImportCacher(mockCompiler);
    await expect(
      importCacher.getPackage(invalidPackageLocation),
    ).rejects.toThrow(
      `Package '${invalidPackageLocation}' missing file extension ${FIZ_FILE_EXTENSION}`,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("should return the exact same cached promise", async () => {
    const fetchPromise = new Promise(() => {});
    global.fetch = vi.fn().mockReturnValue(fetchPromise);

    const importCacher = new ImportCacher(mockCompiler);
    const result1 = importCacher.getPackage(packageLocation);
    const result2 = importCacher.getPackage(packageLocation);

    expect(result1).toBe(result2);
  });

  test("should cache the fetched package", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("package source"),
    });

    const importCacher = new ImportCacher(mockCompiler);
    await importCacher.getPackage(packageLocation);
    const result = await importCacher.getPackage(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockDag);

    const cachedResult = await importCacher.getPackage(packageLocation);

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
    await importCacher.getPackage(packageLocation);
    importCacher.clearCache();
    await importCacher.getPackage(packageLocation);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("should throw an error if fetch status unsuccessful", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    });
    const importCacher = new ImportCacher(mockCompiler);

    await expect(importCacher.getPackage(packageLocation)).rejects.toThrow(
      "Failed to fetch package from 'test-package.fiz': Not Found",
    );
  });

  test("should throw an error if fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch"));
    const importCacher = new ImportCacher(mockCompiler);

    await expect(importCacher.getPackage(packageLocation)).rejects.toThrow(
      "Failed to fetch",
    );
  });
});
