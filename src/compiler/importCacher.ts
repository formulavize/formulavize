import { FIZ_FILE_EXTENSION } from "./constants";
import { Dag } from "./dag";
import { Compiler } from "./driver";
import { Compilation } from "./compilation";

interface PackageCache {
  [key: string]: Promise<Compilation>;
}

export class ImportCacher {
  private cache: PackageCache;
  private compiler: Compiler.Driver;

  constructor(compiler: Compiler.Driver) {
    this.cache = {};
    this.compiler = compiler;
  }

  private async compilePackageSource(
    source: string,
    seenImports: Set<string>,
  ): Promise<Compilation> {
    const sourceGen = Compiler.sourceFromSource;
    const parser = Compiler.parseFromSource;
    const compilation = await this.compiler.compile(
      source,
      sourceGen,
      parser,
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

  clearCache(): void {
    this.cache = {};
  }
}
