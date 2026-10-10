import { FIZ_FILE_EXTENSION } from "./constants";
import { Compilation } from "./compilation";
import { getImportsFromRecipe } from "./astUtility";
import { ErrorCode, describeError } from "./compilationErrors";

export type CompileFromSourceFn = (
  source: string,
  seenImports: ReadonlySet<string>,
) => Promise<Compilation>;

// How a package location is turned into recipe text. The default reaches for
// the network; the CLI supplies a filesystem-backed one so that a relative
// import resolves against the input file rather than failing to parse as a URL.
export type FetchSourceFn = (packageLocation: string) => Promise<string>;

export class ImportError extends Error {
  readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = "ImportError";
    this.code = code;
  }
}

export const IMPORT_FETCH_TIMEOUT_MS: number = 10_000;
export const MAX_IMPORT_BYTES: number = 4 * 1024 * 1024;

// Never fetched, and never used to resolve anything: a relative location is
// only parseable as a URL against some base, and inspecting its path needs one.
const LOCATION_PATH_BASE: string = "file:///";

function hasFizExtension(packageLocation: string): boolean {
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
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? `timed out after ${IMPORT_FETCH_TIMEOUT_MS}ms`
        : describeError(error);
    throw new ImportError(
      `Failed to fetch package from '${packageLocation}': ${reason}`,
      ErrorCode.ImportFetchFailed,
    );
  }

  if (!response.ok) {
    // statusText is empty over HTTP/2, and a mock may carry neither
    const statusInfo =
      [response.status, response.statusText].filter(Boolean).join(" ") ||
      "unknown error";
    throw new ImportError(
      `Failed to fetch package from '${packageLocation}': ${statusInfo}`,
      ErrorCode.ImportFetchFailed,
    );
  }

  assertFizContentType(response.headers.get("content-type"), packageLocation);

  return readBoundedText(response, packageLocation);
}

// Drops a cached promise, but only while it is still the entry under that key.
// A clearCache() or a later request may have replaced it since it settled, and
// evicting the replacement would throw away a result nothing went wrong with.
function evictIfCurrent<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  cachedPromise: Promise<T>,
): void {
  if (cache.get(key) === cachedPromise) cache.delete(key);
}

export class ImportCacher {
  // Fetched source is cacheable unconditionally: what a location holds does not
  // depend on who asked for it. A compilation does, so the two are kept apart.
  private readonly sourceCache = new Map<string, Promise<string>>();
  private readonly compilationCache = new Map<string, Promise<Compilation>>();
  private readonly compileSourceFn: CompileFromSourceFn;
  private readonly fetchSourceFn: FetchSourceFn;

  constructor(
    compileSourceFn: CompileFromSourceFn,
    fetchSourceFn: FetchSourceFn = fetchSourceOverHttp,
  ) {
    this.compileSourceFn = compileSourceFn;
    this.fetchSourceFn = fetchSourceFn;
  }

  private getSource(packageLocation: string): Promise<string> {
    const cachedSource = this.sourceCache.get(packageLocation);
    if (cachedSource) return cachedSource;

    const sourcePromise = this.fetchSourceFn(packageLocation);
    this.sourceCache.set(packageLocation, sourcePromise);
    // A cached rejection would make one transient failure permanent, so the
    // entry is evicted once it is known to have failed. Attaching the handler
    // here also keeps the rejection from being reported as unhandled.
    sourcePromise.catch(() =>
      evictIfCurrent(this.sourceCache, packageLocation, sourcePromise),
    );
    return sourcePromise;
  }

  private async makePackagePromise(
    packageLocation: string,
    seenImports: ReadonlySet<string>,
  ): Promise<Compilation> {
    const source = await this.getSource(packageLocation);
    return this.compileSourceFn(source, seenImports);
  }

  // The cached compilation itself, shared by every caller. Its dag is the
  // cached instance, so a caller that mutates what it receives (Id, Name,
  // re-parenting) must take its own Dag.clone() first.
  getPackageCompilation(
    packageLocation: string,
    seenImports: ReadonlySet<string> = new Set(),
  ): Promise<Compilation> {
    // The suffix is usually the last thing users input
    // so this check only allows a fetch attempt with the complete location.
    // This prevents the user from fetching non-fiz text and popularizes
    // the .fiz extension (also enforcing the formulavize spelling with a 'z').
    // It runs before the cache lookup so no unvalidated key is ever probed.
    if (!hasFizExtension(packageLocation)) {
      return Promise.reject(
        new ImportError(
          `Package '${packageLocation}' missing file extension ${FIZ_FILE_EXTENSION}`,
          ErrorCode.ImportMissingExtension,
        ),
      );
    }

    // Prevent circular imports
    if (seenImports.has(packageLocation)) {
      // Everything on the current chain is compiling without this package's
      // contents, so none of those compilations may be reused elsewhere. Their
      // promises are still in flight; dropping the entries now leaves each
      // awaiter with the result it asked for and leaves nothing behind to
      // hand a caller that has no cycle.
      seenImports.forEach((seenImport) => {
        this.compilationCache.delete(seenImport);
      });
      return Promise.reject(
        new ImportError(
          `Circular import detected: ${packageLocation}`,
          ErrorCode.ImportCircular,
        ),
      );
    }

    // Assumes packageLocation uniquely identifies a package
    // versioning is currently the responsibility of the package implementer
    // to put in the packageLocation (e.g. packageLocation = "pkg-1.0.0.fiz")
    const cachedCompilation = this.compilationCache.get(packageLocation);
    if (cachedCompilation) return cachedCompilation;

    const newSeenImports = new Set([...seenImports, packageLocation]);
    const compilationPromise = this.makePackagePromise(
      packageLocation,
      newSeenImports,
    );
    this.compilationCache.set(packageLocation, compilationPromise);
    compilationPromise.catch(() =>
      evictIfCurrent(
        this.compilationCache,
        packageLocation,
        compilationPromise,
      ),
    );
    return compilationPromise;
  }

  getCachedCompilation(
    packageLocation: string,
  ): Promise<Compilation | undefined> {
    const cachedCompilation = this.compilationCache.get(packageLocation);
    if (!cachedCompilation) return Promise.resolve(undefined);
    // never surface a cached failure as a rejection to a cache peek
    return cachedCompilation.catch(() => undefined);
  }

  clearCache(): void {
    this.sourceCache.clear();
    this.compilationCache.clear();
  }

  // Returns map of package locations to their imports for debugging.
  getDependencyTree(
    startingPackage: string,
  ): Promise<Map<string, Set<string>>> {
    return this.collectDependencies(startingPackage, new Set(), new Map());
  }

  private async collectDependencies(
    startingPackage: string,
    seenImports: Set<string>,
    importsByPackage: Map<string, Set<string>>,
  ): Promise<Map<string, Set<string>>> {
    // One map is threaded through the whole walk so a package shared by
    // several importers is visited once instead of once per path to it. A
    // package is recorded before the walk descends into its imports, so this
    // also covers the current chain: re-entering it would otherwise trip
    // getPackageCompilation's cycle check, which taints and evicts cached
    // compilations the walk only meant to read.
    if (importsByPackage.has(startingPackage)) return importsByPackage;

    const compilation = await this.getPackageCompilation(
      startingPackage,
      seenImports,
    ).catch(() => null);
    if (!compilation) return importsByPackage;

    const imports = getImportsFromRecipe(compilation.AST);
    importsByPackage.set(startingPackage, imports);

    const newSeenImports = new Set([...seenImports, startingPackage]);
    for (const imp of imports) {
      await this.collectDependencies(imp, newSeenImports, importsByPackage);
    }
    return importsByPackage;
  }

  async getFlatDependencyList(startingPackage: string): Promise<Set<string>> {
    const dependencyTree = await this.getDependencyTree(startingPackage);
    const dependencySetsList = Array.from(dependencyTree.values());
    const dependencyLists = dependencySetsList.map((depSet) =>
      Array.from(depSet),
    );
    return new Set(dependencyLists.flat());
  }
}

// Pairs a cacher with the import chain a request sits on, so the two travel
// as one value instead of as two parameters threaded side by side through
// every statement handler. Both are private: a caller only ever needs the
// compilation for a location, and the chain a nested import inherits is
// derived inside the cacher.
export class ImportResolver {
  constructor(
    private readonly cacher: ImportCacher,
    private readonly seenImports: ReadonlySet<string> = new Set(),
  ) {}

  getCompilation(packageLocation: string): Promise<Compilation> {
    return this.cacher.getPackageCompilation(packageLocation, this.seenImports);
  }
}
