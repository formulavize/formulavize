import { expect } from "vitest";
import { ErrorCode } from "src/compiler/compilationErrors";
import { ImportError } from "src/compiler/compilationErrors";

// Shared by importFetcher.test.ts and importCacher.test.ts: both drive the
// same mocked fetch, one through the transport directly and one through the
// cache on top of it.

// Header values are matched case-insensitively by name, the way a real Headers
// is, but their contents are handed back verbatim so a test can check that the
// fetcher lowercases them itself.
export function makeMockHeaders(entries: Record<string, string>) {
  return {
    get: (key: string) => entries[key.toLowerCase()] ?? null,
  };
}

export function makeMockHeaderWithContentType(contentType: string) {
  return makeMockHeaders({ "content-type": contentType });
}

export function makeDefaultMockHeader() {
  return makeMockHeaderWithContentType("text/plain");
}

export async function captureRejection(
  promise: Promise<unknown>,
): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (error) => error,
  );
}

export async function expectImportError(
  promise: Promise<unknown>,
  code: ErrorCode,
): Promise<ImportError> {
  const error = await captureRejection(promise);
  expect(error).toBeInstanceOf(ImportError);
  const importError = error as ImportError;
  expect(importError.code).toEqual(code);
  return importError;
}
