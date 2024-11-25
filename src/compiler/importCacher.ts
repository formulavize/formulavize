import { FIZ_FILE_EXTENSION } from "./constants";
import { Dag } from "./dag";
import { Compiler } from "./driver";

interface PackageCache {
  [key: string]: Promise<Dag>;
}

export class ImportCacher {
  private cache: PackageCache;
  private compiler: Compiler.Driver;

  constructor(compiler: Compiler.Driver) {
    this.cache = {};
    this.compiler = compiler;
  }

  private compilePackageSourceToDag(source: string): Dag {
    const sourceGen = Compiler.sourceFromSource;
    const parser = Compiler.parseFromSource;
    return this.compiler.compile(source, sourceGen, parser).DAG;
  }

  private async makePackagePromise(packageLocation: string): Promise<Dag> {
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
        return this.compilePackageSourceToDag(source);
      });
  }

  getPackage(packageLocation: string): Promise<Dag> {
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

    const packagePromise = this.makePackagePromise(packageLocation);
    this.cache[packageLocation] = packagePromise;
    return packagePromise;
  }

  clearCache(): void {
    this.cache = {};
  }
}
