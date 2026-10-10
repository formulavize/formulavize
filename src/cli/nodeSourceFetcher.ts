import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FetchSourceFn,
  ImportError,
  fetchSourceOverHttp,
} from "../compiler/importFetcher";
import { ErrorCode, describeError } from "../compiler/compilationErrors";

// Node's fetch requires an absolute URL, so a recipe's '@ "lib.fiz"' cannot be
// fetched the way a browser resolves it against the page origin. Outside a
// browser the natural equivalent is the directory the recipe itself lives in,
// so a relative import is read from disk and only absolute http(s) locations
// go to the network. This module is the one place that touches node:fs, and
// must stay out of anything the browser bundle reaches.
export function makeNodeSourceFetcher(baseDir: string): FetchSourceFn {
  return async function fetchSource(packageLocation: string): Promise<string> {
    const filePath = resolveLocalPath(packageLocation, baseDir);
    if (filePath === null) return fetchSourceOverHttp(packageLocation);

    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      throw new ImportError(
        `Failed to read package from '${filePath}': ${describeError(error)}`,
        ErrorCode.ImportFetchFailed,
      );
    }
  };
}

// Returns the local path to read, or null when the location names a remote
// resource that should be fetched instead.
function resolveLocalPath(
  packageLocation: string,
  baseDir: string,
): string | null {
  let url: URL;
  try {
    url = new URL(packageLocation);
  } catch {
    // not a URL at all: a relative or absolute filesystem path
    return isAbsolute(packageLocation)
      ? packageLocation
      : resolve(baseDir, packageLocation);
  }

  if (url.protocol === "file:") return fileURLToPath(url);
  return null;
}
