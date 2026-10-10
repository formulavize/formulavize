import { FIZ_FILE_EXTENSION } from "./constants";
import { Compilation } from "./compilation";
import { getImportsFromRecipe } from "./astUtility";
import { ErrorCode } from "./compilationErrors";

export type CompileFromSourceFn = (
  source: string,
  seenImports: Set<string>,
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

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function hasFizExtension(packageLocation: string): boolean {
  // Check the path, not the whole location: a query string or fragment is not
  // part of the file name ('pkg.fiz?v=2' is a fiz file, '/index.html#pkg.fiz'
  // is not).
  try {
    return new URL(packageLocation).pathname.endsWith(FIZ_FILE_EXTENSION);
  } catch {
    // a relative location is not a parseable URL on its own
    const [pathOnly] = packageLocation.split(/[?#]/, 1);
    return pathOnly.endsWith(FIZ_FILE_EXTENSION);
  }
}

function makeTimeoutSignal(): AbortSignal | undefined {
  // guarded so an environment without AbortSignal.timeout still fetches
  return typeof AbortSignal?.timeout === "function"
    ? AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS)
    : undefined;
}

function isAllowedContentType(contentType: string): boolean {
  // Allow-list rather than deny-list, but a generous one: fiz files are served
  // as text/plain by GitHub raw, as application/octet-stream by some object
  // stores, and with no type at all by plenty of static servers.
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  if (!mediaType) return true;
  if (mediaType.startsWith("text/")) return true;
  return (
    mediaType === "application/octet-stream" ||
    mediaType.startsWith("application/x-")
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
    response = await fetch(packageLocation, { signal: makeTimeoutSignal() });
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

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new ImportError(
      `Expected a fiz file but received HTML from '${packageLocation}'`,
      ErrorCode.ImportHtmlResponse,
    );
  }
  if (!isAllowedContentType(contentType)) {
    throw new ImportError(
      `Expected a fiz file but received '${contentType}' from '${packageLocation}'`,
      ErrorCode.ImportInvalidContentType,
    );
  }

  return readBoundedText(response, packageLocation);
}

export class ImportCacher {
  // Fetched source is cacheable unconditionally: what a location holds does not
  // depend on who asked for it. A compilation does, so the two are kept apart.
  private sourceCache: Map<string, Promise<string>>;
  private compilationCache: Map<string, Promise<Compilation>>;
  // Locations whose in-flight compilation was truncated by the cycle check.
  // Those results are only valid for the import chain that produced them, so
  // they are dropped rather than served to a caller that has no cycle.
  private cycleTruncated: Set<string>;
  private compileSourceFn: CompileFromSourceFn;
  private fetchSourceFn: FetchSourceFn;

  constructor(
    compileSourceFn: CompileFromSourceFn,
    fetchSourceFn: FetchSourceFn = fetchSourceOverHttp,
  ) {
    this.sourceCache = new Map();
    this.compilationCache = new Map();
    this.cycleTruncated = new Set();
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
    sourcePromise.catch(() => {
      if (this.sourceCache.get(packageLocation) === sourcePromise) {
        this.sourceCache.delete(packageLocation);
      }
    });
    return sourcePromise;
  }

  private async makePackagePromise(
    packageLocation: string,
    seenImports: Set<string>,
  ): Promise<Compilation> {
    const source = await this.getSource(packageLocation);
    return this.compileSourceFn(source, seenImports);
  }

  private evictCompilation(
    packageLocation: string,
    compilationPromise: Promise<Compilation>,
  ): void {
    if (this.compilationCache.get(packageLocation) === compilationPromise) {
      this.compilationCache.delete(packageLocation);
    }
  }

  private getPackage(
    packageLocation: string,
    seenImports: Set<string> = new Set(),
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
      // contents, so none of those compilations may be reused elsewhere.
      seenImports.forEach((seenImport) => {
        this.cycleTruncated.add(seenImport);
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
    compilationPromise.then(
      () => {
        // The taint is consumed here: if the cycle is still there on the next
        // compile it is recorded again, and if the recipe was fixed the result
        // becomes cacheable once more.
        if (!this.cycleTruncated.delete(packageLocation)) return;
        this.evictCompilation(packageLocation, compilationPromise);
      },
      () => this.evictCompilation(packageLocation, compilationPromise),
    );
    return compilationPromise;
  }

  // The cached compilation itself, shared by every caller. Its dag is the
  // cached instance, so a caller that mutates what it receives (Id, Name,
  // re-parenting) must take its own Dag.clone() first.
  getPackageCompilation(
    packageLocation: string,
    seenImports: Set<string> = new Set(),
  ): Promise<Compilation> {
    return this.getPackage(packageLocation, seenImports);
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
    this.sourceCache = new Map();
    this.compilationCache = new Map();
    this.cycleTruncated = new Set();
  }

  async getDependencyTree(
    startingPackage: string,
    seenImports: Set<string> = new Set(),
    importsByPackage: Map<string, Set<string>> = new Map(),
  ): Promise<Map<string, Set<string>>> {
    // Create a map of package locations to their imports for debugging.
    // One map is threaded through the whole walk so a package shared by
    // several importers is visited once instead of once per path to it.
    if (seenImports.has(startingPackage)) return importsByPackage;
    if (importsByPackage.has(startingPackage)) return importsByPackage;

    const compilation = await this.getPackageCompilation(
      startingPackage,
      seenImports,
    ).catch(() => {
      return null;
    });
    if (!compilation) return importsByPackage;

    const imports = getImportsFromRecipe(compilation.AST);
    importsByPackage.set(startingPackage, imports);

    const newSeenImports = new Set([...seenImports, startingPackage]);
    for (const imp of imports) {
      await this.getDependencyTree(imp, newSeenImports, importsByPackage);
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
