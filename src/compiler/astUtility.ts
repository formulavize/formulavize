import { match } from "ts-pattern";
import {
  AssignmentTreeNode,
  ImportTreeNode,
  NamespaceTreeNode,
  NodeType,
  RecipeTreeNode,
  StatementTreeNode,
} from "./ast";

function getImportsFromStatments(statements: StatementTreeNode[]): Set<string> {
  const imports = statements.flatMap((statement) => {
    return match(statement.Type)
      .with(NodeType.Import, () => {
        const importNode = statement as ImportTreeNode;
        return [importNode.ImportLocation];
      })
      .with(NodeType.Assignment, () => {
        const assignmentNode = statement as AssignmentTreeNode;
        if (!assignmentNode.Rhs) return [];
        if (assignmentNode.Rhs.Type !== NodeType.Import) return [];
        const rhsImportNode = assignmentNode.Rhs as ImportTreeNode;
        return [rhsImportNode.ImportLocation];
      })
      .with(NodeType.Namespace, () => {
        const namespaceNode = statement as NamespaceTreeNode;
        return Array.from(
          getImportsFromStatments(
            namespaceNode.StatementList?.Statements || [],
          ),
        );
      })
      .otherwise(() => []);
  });
  return new Set(imports);
}

export function getImportsFromRecipe(recipe: RecipeTreeNode): Set<string> {
  return getImportsFromStatments(recipe.Statements);
}
