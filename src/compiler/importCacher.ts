import { FIZ_FILE_EXTENSION } from "./constants";
import { RecipeTreeNode } from "./ast";
import { ParseResult, parseFromSource } from "./parser";
import { getImportsFromRecipe } from "./astUtility";
import { CompilationError, ErrorCode, ImportError } from "./compilationErrors";
import {
  FetchSourceFn,
  fetchSourceOverHttp,
  hasFizExtension,
} from "./importFetcher";

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

// What a location holds does not depend on who asked for it, and neither does
// the tree that text parses to, so one cache covers both and nothing in it is
// ever conditional on an import chain. A compiled dag is a different matter --
// its ids and nesting belong to the site that imported it -- so no dag is
// cached here at all; each import site builds its own from the cached parse.
export class ImportCacher {
  private readonly parseCache = new Map<string, Promise<ParseResult>>();
  private readonly fetchSourceFn: FetchSourceFn;

  constructor(fetchSourceFn: FetchSourceFn = fetchSourceOverHttp) {
    this.fetchSourceFn = fetchSourceFn;
  }

  getParsedRecipe(packageLocation: string): Promise<ParseResult> {
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

    // Assumes packageLocation uniquely identifies a package
    // versioning is currently the responsibility of the package implementer
    // to put in the packageLocation (e.g. packageLocation = "pkg-1.0.0.fiz")
    const cachedParse = this.parseCache.get(packageLocation);
    if (cachedParse) return cachedParse;

    const parsePromise =
      this.fetchSourceFn(packageLocation).then(parseFromSource);
    this.parseCache.set(packageLocation, parsePromise);
    // A cached rejection would make one transient failure permanent, so the
    // entry is evicted once it is known to have failed. Attaching the handler
    // here also keeps the rejection from being reported as unhandled.
    parsePromise.catch(() =>
      evictIfCurrent(this.parseCache, packageLocation, parsePromise),
    );
    return parsePromise;
  }

  // A peek at what is already parsed, for the callers that only want to read
  // an imported recipe's shape (the import dump, the completion index) rather
  // than pull a package in. Never fetches, and never rejects: a location that
  // was never asked for and one whose fetch failed both read as undefined, so
  // a caller has nothing to catch.
  getCachedAst(packageLocation: string): Promise<RecipeTreeNode | undefined> {
    const cachedParse = this.parseCache.get(packageLocation);
    if (!cachedParse) return Promise.resolve(undefined);
    return cachedParse.then(
      ({ ast }) => ast,
      () => undefined,
    );
  }

  clearCache(): void {
    this.parseCache.clear();
  }

  // Returns map of package locations to their imports for debugging.
  // No production caller yet; kept for future debugging tooling.
  async getDependencyTree(
    startingPackage: string,
  ): Promise<Map<string, Set<string>>> {
    // One map is threaded through the whole walk, so a package shared by
    // several importers is visited once instead of once per path to it. That
    // is also all the cycle safety this walk needs: a package is recorded
    // before the walk descends into its imports, so re-entering it returns
    // immediately.
    const importsByPackage = new Map<string, Set<string>>();

    const visit = async (packageLocation: string): Promise<void> => {
      if (importsByPackage.has(packageLocation)) return;
      const parsed = await this.getParsedRecipe(packageLocation).catch(
        () => null,
      );
      if (!parsed) return;
      const imports = getImportsFromRecipe(parsed.ast);
      importsByPackage.set(packageLocation, imports);
      for (const imported of imports) await visit(imported);
    };

    await visit(startingPackage);
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

// A package's recipe, plus the resolver the next level down must use. The two
// travel together so a caller cannot build a nested dag with the chain it was
// handed rather than the one that includes this package.
export interface ResolvedImport {
  ast: RecipeTreeNode;
  parseErrors: CompilationError[];
  resolver: ImportResolver;
}

// Pairs a cacher with the import chain a request sits on, so the two travel
// as one value instead of as two parameters threaded side by side through
// every statement handler. Both are private: a caller only ever needs the
// recipe for a location, and the chain a nested import inherits comes back
// with it.
export class ImportResolver {
  constructor(
    private readonly cacher: ImportCacher,
    private readonly chain: ReadonlySet<string> = new Set(),
  ) {}

  async getImport(packageLocation: string): Promise<ResolvedImport> {
    // Prevent circular imports. Nothing cached is conditional on the chain, so
    // reporting the cycle is all there is to do: the packages on the chain are
    // compiling without this one's contents, but each is a dag belonging to one
    // import site and is never handed to another.
    if (this.chain.has(packageLocation)) {
      throw new ImportError(
        `Circular import detected: ${packageLocation}`,
        ErrorCode.ImportCircular,
      );
    }

    const { ast, errors } = await this.cacher.getParsedRecipe(packageLocation);
    // extended only once the location is known to be a real package, so an
    // unfetchable location never lands on a chain
    return {
      ast,
      parseErrors: errors,
      resolver: new ImportResolver(
        this.cacher,
        new Set([...this.chain, packageLocation]),
      ),
    };
  }
}
