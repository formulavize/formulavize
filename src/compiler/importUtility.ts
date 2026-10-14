import { RecipeTreeNode } from "./ast";
import { getImportsFromRecipe } from "./astUtility";

// Only the cache peek is needed here: the dump reports what has already been
// compiled and never pulls in a package to describe it. Resolving to undefined
// is how both a miss and a failed import are reported, so there is nothing to
// catch.
interface AstCacher {
  getCachedAst(packageLocation: string): Promise<RecipeTreeNode | undefined>;
}

async function dumpImportTreeHelper(
  cacher: AstCacher,
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

      const cachedAst = await cacher.getCachedAst(importPath);

      if (!cachedAst) return baseLine;

      const transitiveImports = getImportsFromRecipe(cachedAst);
      const newVisitedImports = new Set([...visitedImports, importPath]);
      const childLines = await dumpImportTreeHelper(
        cacher,
        transitiveImports,
        level + 1,
        newVisitedImports,
      );

      if (!childLines) return baseLine;

      return `${baseLine}\n${childLines}`;
    }),
  );

  return lines.join("\n");
}

export async function dumpImportTree(
  cacher: AstCacher,
  recipe: RecipeTreeNode,
): Promise<string> {
  const topLevelImports = getImportsFromRecipe(recipe);
  if (topLevelImports.size === 0) return "(no imports)";
  return dumpImportTreeHelper(cacher, topLevelImports, 0, new Set());
}
