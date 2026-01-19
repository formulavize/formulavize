import { FIZ_FILE_EXTENSION } from "./constants";
import { Dag } from "./dag";
import { Compiler } from "./driver";
import { Compilation } from "./compilation";
import { getImportsFromRecipe } from "./astUtility";

interface PackageCache {
  [key: string]: Promise<Compilation>;
}

export class ImportCacher {
  private cache: PackageCache;
  private compiler: Compiler;

  constructor(compiler: Compiler) {
    this.cache = {};
    this.compiler = compiler;
  }

  private async compilePackageSource(
    source: string,
    seenImports: Set<string>,
  ): Promise<Compilation> {
    const compilation = await this.compiler.compileFromSource(
      source,
      seenImports,
    );
    return compilation;
  }

  private async makePackagePromise(
    packageLocation: string,
    seenImports: Set<string>,
  ): Promise<Compilation> {
    return fetch(packageLocation)
      .then((response) => {
        if (!response.ok) {
          return Promise.reject(
            new Error(
              `Failed to fetch package from '${packageLocation}': ${response.statusText}`,
            ),
          );
        }
        return response.text();
      })
      .then((source) => {
        return this.compilePackageSource(source, seenImports);
      });
  }

  private getPackage(
    packageLocation: string,
    seenImports: Set<string> = new Set(),
  ): Promise<Compilation> {
    // Prevent circular imports
    if (seenImports.has(packageLocation)) {
      return Promise.reject(`Circular import detected: ${packageLocation}`);
    }

    // Assumes packageLocation uniquely identifies a package
    // versioning is currently the responsibility of the package implementer
    // to put in the packageLocation (e.g. packageLocation = "pkg-1.0.0.fiz")
    if (packageLocation in this.cache) return this.cache[packageLocation];

    // The suffix is usually the last thing users input
    // so this check only allows a fetch attempt with the complete location.
    // This prevents the user from fetching non-fiz text and popularizes
    // the .fiz extension (also enforcing the formulavize spelling with a 'z')
    if (!packageLocation.endsWith(FIZ_FILE_EXTENSION)) {
      return Promise.reject(
        new Error(
          `Package '${packageLocation}' missing file extension ${FIZ_FILE_EXTENSION}`,
        ),
      );
    }

    const newSeenImports = new Set([...seenImports, packageLocation]);
    const packagePromise = this.makePackagePromise(
      packageLocation,
      newSeenImports,
    );
    this.cache[packageLocation] = packagePromise;
    return packagePromise;
  }

  async getPackageDag(
    packageLocation: string,
    seenImports: Set<string> = new Set(),
  ): Promise<Dag> {
    const compilation = await this.getPackage(packageLocation, seenImports);
    return compilation.DAG;
  }

  async getCachedCompilation(
    packageLocation: string,
  ): Promise<Compilation | undefined> {
    return this.cache[packageLocation];
  }

  clearCache(): void {
    this.cache = {};
  }

  async getDependencyTree(
    startingPackage: string,
    seenImports: Set<string> = new Set(),
  ): Promise<Map<string, Set<string>>> {
    // Create a map of package locations to their imports for debugging
    if (seenImports.has(startingPackage)) {
      return new Map();
    }
    const compilation = await this.getPackage(
      startingPackage,
      seenImports,
    ).catch(() => {
      return null;
    });
    if (!compilation) return new Map();
    const imports = getImportsFromRecipe(compilation.AST);
    const result = new Map<string, Set<string>>([[startingPackage, imports]]);
    for (const imp of imports) {
      const newSeenImports = new Set([...seenImports, startingPackage]);
      const subTree = await this.getDependencyTree(imp, newSeenImports);
      for (const [key, value] of subTree) {
        result.set(key, value);
      }
    }
    return result;
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
