import { FIZ_FILE_EXTENSION } from "./constants";
import { ErrorCode, ImportError, describeError } from "./compilationErrors";

// How an import location becomes recipe text, and what counts as a plausible
// fiz file on the way in. Nothing here caches or compiles anything: this is
// the transport layer that `importCacher` memoizes.

// How a package location is turned into recipe text. The default reaches for
// the network; the CLI supplies a filesystem-backed one so that a relative
// import resolves against the input file rather than failing to parse as a URL.
export type FetchSourceFn = (packageLocation: string) => Promise<string>;

export const IMPORT_FETCH_TIMEOUT_MS: number = 10_000;
export const MAX_IMPORT_BYTES: number = 4 * 1024 * 1024;

// Never fetched, and never used to resolve anything: a relative location is
// only parseable as a URL against some base, and inspecting its path needs one.
const LOCATION_PATH_BASE: string = "file:///";

// Whether a location could name a fiz file at all. Exported because the caller
// is the cacher rather than the fetcher: the check has to run before the cache
// is probed, so no unvalidated key is ever looked up. It sits beside
// assertFizContentType so the two 'is this a fiz file' tests cannot drift.
export function hasFizExtension(packageLocation: string): boolean {
  // Check the path, not the whole location: a query string or fragment is not
  // part of the file name ('pkg.fiz?v=2' is a fiz file, '/index.html#pkg.fiz'
  // is not). Relative and absolute locations go through the same parse, which
  // also means a stray surrounding space is tolerated here exactly as fetch
  // tolerates it.
  try {
    return new URL(packageLocation, LOCATION_PATH_BASE).pathname.endsWith(
      FIZ_FILE_EXTENSION,
    );
  } catch {
    // A location too malformed to parse has no path to inspect, and cannot be
    // fetched either. Pass it on so the fetch reports what is wrong with it,
    // rather than claiming the extension is missing from a location that may
    // well carry one.
    return true;
  }
}

// Throws unless the response could plausibly be a fiz file.
function assertFizContentType(
  rawContentType: string | null,
  packageLocation: string,
): void {
  const contentType = (rawContentType ?? "").toLowerCase();

  // Deliberately a substring test over the whole header rather than the media
  // type alone: a server that lists html among several types is still handing
  // back a web page rather than a fiz file.
  if (contentType.includes("text/html")) {
    throw new ImportError(
      `Expected a fiz file but received HTML from '${packageLocation}'`,
      ErrorCode.ImportHtmlResponse,
    );
  }

  // Allow-list rather than deny-list, but a generous one: fiz files are served
  // as text/plain by GitHub raw, as application/octet-stream by some object
  // stores, and with no type at all by plenty of static servers. The
  // parameters ('; charset=utf-8') are not part of the media type.
  const mediaType = contentType.split(";")[0].trim();
  const isAllowed =
    !mediaType ||
    mediaType.startsWith("text/") ||
    mediaType === "application/octet-stream" ||
    mediaType.startsWith("application/x-");
  if (!isAllowed) {
    throw new ImportError(
      `Expected a fiz file but received '${contentType}' from '${packageLocation}'`,
      ErrorCode.ImportInvalidContentType,
    );
  }
}

function describeFetchFailure(error: unknown): string {
  return error instanceof Error && error.name === "TimeoutError"
    ? `timed out after ${IMPORT_FETCH_TIMEOUT_MS}ms`
    : describeError(error);
}

function makeFetchError(packageLocation: string, reason: string): ImportError {
  return new ImportError(
    `Failed to fetch package from '${packageLocation}': ${reason}`,
    ErrorCode.ImportFetchFailed,
  );
}

async function readBoundedText(
  response: Response,
  packageLocation: string,
): Promise<string> {
  const tooLarge = () =>
    new ImportError(
      `Package '${packageLocation}' exceeds the ${MAX_IMPORT_BYTES} byte import limit`,
      ErrorCode.ImportFetchFailed,
    );

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMPORT_BYTES) {
    throw tooLarge();
  }

  // Stream when the body is readable so an undeclared huge response is cut off
  // before it is buffered; fall back to text() when it is not.
  const body = response.body;
  if (!body) {
    const text = await response.text();
    if (text.length > MAX_IMPORT_BYTES) throw tooLarge();
    return text;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_IMPORT_BYTES) {
      await reader.cancel();
      throw tooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchSourceOverHttp(
  packageLocation: string,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(packageLocation, {
      signal: AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw makeFetchError(packageLocation, describeFetchFailure(error));
  }

  if (!response.ok) {
    // statusText is empty over HTTP/2, and a mock may carry neither
    const statusInfo =
      [response.status, response.statusText].filter(Boolean).join(" ") ||
      "unknown error";
    throw makeFetchError(packageLocation, statusInfo);
  }

  assertFizContentType(response.headers.get("content-type"), packageLocation);

  // The body is read inside the same try as the headers would be: the fetch
  // signal stays attached until the body is fully read, so the deadline can
  // just as well expire here, and the connection can still drop mid-stream.
  // Either way the rejection is the fetch failing and is reported as such,
  // rather than escaping as the bare DOMException or TypeError it arrives as.
  // The size caps already name themselves, so an ImportError passes through
  // instead of being wrapped in a second message.
  try {
    return await readBoundedText(response, packageLocation);
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw makeFetchError(packageLocation, describeFetchFailure(error));
  }
}
