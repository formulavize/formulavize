import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { makeNodeSourceFetcher } from "src/cli/nodeSourceFetcher";
import { ImportError } from "src/compiler/compilationErrors";
import { ErrorCode } from "src/compiler/compilationErrors";

describe("node source fetcher", () => {
  let baseDir: string;
  const recipe = "f()";

  beforeAll(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "fviz-import-"));
    await writeFile(join(baseDir, "lib.fiz"), recipe, "utf8");
  });

  afterAll(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  test("reads a relative location from the base directory", async () => {
    const fetchSource = makeNodeSourceFetcher(baseDir);
    await expect(fetchSource("lib.fiz")).resolves.toEqual(recipe);
  });

  test("reads an absolute path as given", async () => {
    const fetchSource = makeNodeSourceFetcher("/nonexistent");
    const absolutePath = join(baseDir, "lib.fiz");
    await expect(fetchSource(absolutePath)).resolves.toEqual(recipe);
  });

  test("reads a file URL", async () => {
    const fetchSource = makeNodeSourceFetcher("/nonexistent");
    const fileUrl = pathToFileURL(join(baseDir, "lib.fiz")).href;
    await expect(fetchSource(fileUrl)).resolves.toEqual(recipe);
  });

  test("fetches an http location over the network", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "text/plain" },
      text: () => Promise.resolve(recipe),
    });
    const fetchSource = makeNodeSourceFetcher(baseDir);

    const exampleUrl = "https://example.com/lib.fiz";
    await expect(fetchSource(exampleUrl)).resolves.toEqual(recipe);
    expect(global.fetch).toHaveBeenCalledWith(exampleUrl, expect.anything());
  });

  test("reports an unreadable file as an import error", async () => {
    const fetchSource = makeNodeSourceFetcher(baseDir);
    const error = await fetchSource("missing.fiz").then(
      () => null,
      (err) => err,
    );

    expect(error).toBeInstanceOf(ImportError);
    expect((error as ImportError).code).toEqual(ErrorCode.ImportFetchFailed);
    expect((error as ImportError).message).toContain("missing.fiz");
  });
});
