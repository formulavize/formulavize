import { FIZ_FILE_EXTENSION } from "./constants";
import { RecipeTreeNode } from "./ast";
import { ParseResult, parseFromSource } from "./parser";
import { getImportsFromRecipe } from "./astUtility";
import { ErrorCode, ImportError } from "./compilationErrors";
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

// Resolves one location to its recipe, for a request sitting on `importChain`:
// the locations already being imported above this one. The chain is a
// parameter rather than a captured closure variable, so a resolver is one
// function for a whole compile and the recipe it returns is the parser's own
// ParseResult rather than a wrapper that also has to carry the next resolver.
// Extending the chain is the business of whoever descends into an import
// (dagFactory's getImportedDag), which is also the only place that can.
export type ImportResolver = (
  packageLocation: string,
  importChain: ReadonlySet<string>,
) => Promise<ParseResult>;

// Pairs a cacher with the circular-import check. Every other way an import can
// fail already rejects with an ImportError that dagFactory turns into one
// positioned diagnostic, so a cycle travels the same way rather than being
// reported by a second mechanism. Nothing cached is conditional on the chain,
// so refusing the request is all there is to do: the packages on the chain are
// compiling without this one's contents, but each is a dag belonging to one
// import site and is never handed to another.
export function makeImportResolver(cacher: ImportCacher): ImportResolver {
  return function resolveImport(
    packageLocation: string,
    importChain: ReadonlySet<string>,
  ): Promise<ParseResult> {
    if (importChain.has(packageLocation)) {
      return Promise.reject(
        new ImportError(
          `Circular import detected: ${packageLocation}`,
          ErrorCode.ImportCircular,
        ),
      );
    }
    return cacher.getParsedRecipe(packageLocation);
  };
}
