import { RecipeTreeNode } from "./ast";
import { Compilation } from "./compilation";
import { getImportsFromRecipe } from "./astUtility";

interface CompilationCacher {
  getCachedCompilation(
    packageLocation: string,
  ): Promise<Compilation | undefined>;
}

async function dumpImportTreeHelper(
  cacher: CompilationCacher,
  imports: Set<string>,
  level: number,
  visitedImports: Set<string>,
): Promise<string> {
  const indent = "\t".repeat(level);
  const lines = await Promise.all(
    Array.from(imports).map(async (importPath) => {
      const baseLine = `${indent}${importPath}`;

      if (visitedImports.has(importPath)) {
        return `${baseLine}\n${indent}\t*cyclic dependency*`;
      }

      const cachedCompilation = await cacher
        .getCachedCompilation(importPath)
        .catch(() => undefined);

      if (!cachedCompilation) return baseLine;

      const transitiveImports = getImportsFromRecipe(cachedCompilation.AST);
      const newVisitedImports = new Set([...visitedImports, importPath]);
      const childLines = await dumpImportTreeHelper(
        cacher,
        transitiveImports,
        level + 1,
        newVisitedImports,
      );

      return `${baseLine}\n${childLines}`;
    }),
  );

  return lines.join("\n");
}

export async function dumpImportTree(
  cacher: CompilationCacher,
  recipe: RecipeTreeNode,
): Promise<string> {
  const topLevelImports = getImportsFromRecipe(recipe);
  if (topLevelImports.size === 0) return "(no imports)";
  return dumpImportTreeHelper(cacher, topLevelImports, 0, new Set());
}
