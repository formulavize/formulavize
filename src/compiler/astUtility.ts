import { match } from "ts-pattern";
import {
  AssignmentTreeNode,
  ImportTreeNode,
  NamespaceTreeNode,
  NodeType,
  RecipeTreeNode,
  StatementTreeNode,
} from "./ast";

// An import a statement declares, and whether a variable was assigned from it.
// The two forms scope their contents differently, which is why the flag
// travels with the node: a bare import statement with no alias merges its
// contents into the importing scope, while an import on an assignment's right
// hand side keeps them in a scope of their own, reachable only through an
// alias if it carries one (dagFactory's processUnassignedImport vs
// processImport).
export interface DeclaredImport {
  node: ImportTreeNode;
  isAssigned: boolean;
}

function getImportsFromStatement(
  statement: StatementTreeNode,
): DeclaredImport[] {
  return match(statement.Type)
    .with(NodeType.Import, () => [
      { node: statement as ImportTreeNode, isAssigned: false },
    ])
    .with(NodeType.Assignment, () => {
      const assignmentNode = statement as AssignmentTreeNode;
      if (assignmentNode.Rhs?.Type !== NodeType.Import) return [];
      return [{ node: assignmentNode.Rhs as ImportTreeNode, isAssigned: true }];
    })
    .otherwise(() => []);
}

// The imports a statement list declares at its own level. A namespace's
// imports are deliberately not included: it is a scope of its own, and a
// caller that cares about nested scopes walks into them itself.
export function getDeclaredImports(
  statements: StatementTreeNode[],
): DeclaredImport[] {
  return statements.flatMap(getImportsFromStatement);
}

function getImportsFromStatments(statements: StatementTreeNode[]): Set<string> {
  const imports = statements.flatMap((statement) => {
    return match(statement.Type)
      .with(NodeType.Namespace, () => {
        const namespaceNode = statement as NamespaceTreeNode;
        return Array.from(getImportsFromStatments(namespaceNode.Statements));
      })
      .otherwise(() =>
        getImportsFromStatement(statement).map(
          ({ node }) => node.ImportLocation,
        ),
      );
  });
  return new Set(imports);
}

export function getImportsFromRecipe(recipe: RecipeTreeNode): Set<string> {
  return getImportsFromStatments(recipe.Statements);
}
