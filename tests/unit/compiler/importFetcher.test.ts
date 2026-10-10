import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  fetchSourceOverHttp,
  IMPORT_FETCH_TIMEOUT_MS,
  MAX_IMPORT_BYTES,
} from "src/compiler/importFetcher";
import { FIZ_FILE_EXTENSION } from "src/compiler/constants";
import { ErrorCode } from "src/compiler/compilationErrors";
import {
  makeDefaultMockHeader,
  makeMockHeaders,
  makeMockHeaderWithContentType,
  expectImportError,
} from "./importTestHelpers";

// The transport on its own: no cache, so every case here is about what one
// response does or does not qualify as a fiz file. Which locations are
// refused before a fetch is attempted, and which coded error a caller sees
// for them, is the cacher's decision and is tested in importCacher.test.ts.
describe("fetch source over http", () => {
  const packageLocation = `test-package${FIZ_FILE_EXTENSION}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return the body of a successful response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeDefaultMockHeader(),
      text: () => Promise.resolve("package source"),
    });

    await expect(fetchSourceOverHttp(packageLocation)).resolves.toEqual(
      "package source",
    );

    // the signal is what bounds a hung server, so assert it is really attached
    expect(global.fetch).toHaveBeenCalledWith(
      packageLocation,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("should throw an error if fetch status unsuccessful", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      statusText: "Not Found",
    });

    await expect(fetchSourceOverHttp(packageLocation)).rejects.toThrow(
      "Failed to fetch package from 'test-package.fiz': Not Found",
    );
  });

  test("should report the status when a fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(fetchSourceOverHttp(packageLocation)).rejects.toThrow(
      `Failed to fetch package from '${packageLocation}': 404 Not Found`,
    );
  });

  test("should name the location when a response carries no status", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve("failure"),
    });

    await expect(fetchSourceOverHttp(packageLocation)).rejects.toThrow(
      `Failed to fetch package from '${packageLocation}'`,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("should throw an error if fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch"));

    await expect(fetchSourceOverHttp(packageLocation)).rejects.toThrow(
      "Failed to fetch",
    );
  });

  test("should report a fetch timeout as such", async () => {
    const timeoutError = new Error("This operation was aborted");
    timeoutError.name = "TimeoutError";
    global.fetch = vi.fn().mockRejectedValueOnce(timeoutError);

    const error = await expectImportError(
      fetchSourceOverHttp(packageLocation),
      ErrorCode.ImportFetchFailed,
    );
    expect(error.message).toContain(
      `timed out after ${IMPORT_FETCH_TIMEOUT_MS}ms`,
    );
  });

  test("should throw an error if response is HTML", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("text/html; charset=utf-8"),
      text: () => Promise.resolve("<html></html>"),
    });

    await expect(fetchSourceOverHttp(packageLocation)).rejects.toThrow(
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

    await expectImportError(
      fetchSourceOverHttp(packageLocation),
      ErrorCode.ImportHtmlResponse,
    );
  });

  test("should accept an allowed content type in any casing", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("Text/Plain; charset=UTF-8"),
      text: () => Promise.resolve("package source"),
    });

    await expect(fetchSourceOverHttp(packageLocation)).resolves.toEqual(
      "package source",
    );
  });

  test("should reject a response that is not text", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: makeMockHeaderWithContentType("application/json"),
      text: () => Promise.resolve("{}"),
    });

    const error = await expectImportError(
      fetchSourceOverHttp(packageLocation),
      ErrorCode.ImportInvalidContentType,
    );
    expect(error.message).toContain("application/json");
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

    const error = await expectImportError(
      fetchSourceOverHttp(packageLocation),
      ErrorCode.ImportFetchFailed,
    );
    expect(error.message).toContain("import limit");
  });
});
