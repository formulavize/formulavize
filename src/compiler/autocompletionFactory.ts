import { match } from "ts-pattern";
import {
  RecipeTreeNode,
  StatementTreeNode,
  NodeType,
  AssignmentTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
} from "./ast";
import { ASTCompletionIndex, TokenRecord, TokenType } from "./autocompletion";

export function makeASTCompletionIndex(
  recipeNode: RecipeTreeNode,
): ASTCompletionIndex {
  const tokenRecords: TokenRecord[] = [];

  function processStatement(statement: StatementTreeNode): void {
    match(statement.Type)
      .with(NodeType.Assignment, () => {
        const assignmentNode = statement as AssignmentTreeNode;
        assignmentNode.Lhs.forEach((variable) => {
          tokenRecords.push({
            type: TokenType.Variable,
            value: variable.VarName,
            endPosition: variable.Position?.to ?? 0,
          });
        });
      })
      .with(NodeType.NamedStyle, () => {
        const namedStyleNode = statement as NamedStyleTreeNode;
        tokenRecords.push({
          type: TokenType.StyleTag,
          value: namedStyleNode.StyleName,
          endPosition: namedStyleNode.Position?.to ?? 0,
        });
      })
      .with(NodeType.StyleBinding, () => {
        const styleBindingNode = statement as StyleBindingTreeNode;
        tokenRecords.push({
          type: TokenType.Keyword,
          value: styleBindingNode.Keyword,
          endPosition: styleBindingNode.Position?.to ?? 0,
        });
      })
      .otherwise(() => {
        // For other statement types, we don't extract completion tokens
      });
  }
  recipeNode.Statements.forEach(processStatement);

  return new ASTCompletionIndex(tokenRecords);
}
