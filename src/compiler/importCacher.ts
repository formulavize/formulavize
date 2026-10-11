import { FIZ_FILE_EXTENSION } from "./constants";
import { RecipeTreeNode } from "./ast";
import { Compilation } from "./compilation";
import { getImportsFromRecipe } from "./astUtility";
import { ErrorCode } from "./compilationErrors";
import {
  FetchSourceFn,
  ImportError,
  fetchSourceOverHttp,
  hasFizExtension,
} from "./importFetcher";

export type CompileFromSourceFn = (
  source: string,
  importResolver: ImportResolver,
) => Promise<Compilation>;

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
    return this.compileSourceFn(source, new ImportResolver(this, seenImports));
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

  // A peek at what is already compiled, for the callers that only want to read
  // an imported recipe's shape (the import dump, the completion index) rather
  // than pull a package in. Never fetches, and never rejects: a location that
  // was never asked for and one whose compilation failed both read as
  // undefined, so a caller has nothing to catch.
  getCachedAst(packageLocation: string): Promise<RecipeTreeNode | undefined> {
    const cachedCompilation = this.compilationCache.get(packageLocation);
    if (!cachedCompilation) return Promise.resolve(undefined);
    return cachedCompilation.then(
      (compilation) => compilation.AST,
      () => undefined,
    );
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
