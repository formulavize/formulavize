import { match } from "ts-pattern";
import {
  RecipeTreeNode,
  StatementTreeNode,
  NodeType,
  QualifiedVarTreeNode,
  AssignmentTreeNode,
  CallTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
} from "./ast";
import {
  ASTCompletionIndex,
  TokenInfo,
  TokenType,
  ContextScenarioType,
  ContextScenario,
} from "./autocompletion";

function makeTokenRecords(statement: StatementTreeNode): TokenInfo[] {
  return match(statement.Type)
    .with(NodeType.Assignment, () => {
      const assignmentNode = statement as AssignmentTreeNode;
      return assignmentNode.Lhs.map((variable) => ({
        type: TokenType.Variable,
        value: variable.VarName,
        endPosition: assignmentNode.Position?.to ?? 0,
      }));
    })
    .with(NodeType.NamedStyle, () => {
      const namedStyleNode = statement as NamedStyleTreeNode;
      return [
        {
          type: TokenType.StyleTag,
          value: namedStyleNode.StyleName,
          endPosition: namedStyleNode.Position?.to ?? 0,
        },
      ];
    })
    .with(NodeType.StyleBinding, () => {
      const styleBindingNode = statement as StyleBindingTreeNode;
      return [
        {
          type: TokenType.Keyword,
          value: styleBindingNode.Keyword,
          endPosition: styleBindingNode.Position?.to ?? 0,
        },
      ];
    })
    .otherwise(() => []);
}

function makeContextScenarios(statement: StatementTreeNode): ContextScenario[] {
  return match(statement.Type)
    .with(NodeType.QualifiedVariable, () => {
      const varNode = statement as QualifiedVarTreeNode;
      if (!varNode.Position) return [];
      return [
        {
          type: ContextScenarioType.VarStatement,
          from: varNode.Position.from,
          to: varNode.Position.to,
        },
      ];
    })
    .with(NodeType.Assignment, () => {
      const assignmentNode = statement as AssignmentTreeNode;
      if (!assignmentNode.Rhs?.Position) return [];
      return [
        {
          type: ContextScenarioType.ValueName,
          from: assignmentNode.Rhs.Position.from,
          to: assignmentNode.Rhs.Position.to,
        },
      ];
    })
    .with(NodeType.Call, () => {
      const callNode = statement as CallTreeNode;
      const argsPosition = callNode.ArgList?.Position;
      if (!argsPosition) return [];
      return [
        {
          type: ContextScenarioType.ValueName,
          from: argsPosition.from + 1,
          to: argsPosition.to - 1,
        },
      ];
    })
    .with(NodeType.NamedStyle, () => {
      const namedStyleNode = statement as NamedStyleTreeNode;
      if (!namedStyleNode.StyleNode?.Position) return [];
      return [
        {
          type: ContextScenarioType.StyleArgList,
          from: namedStyleNode.StyleNode.Position.from,
          to: namedStyleNode.StyleNode.Position.to,
        },
      ];
    })
    .with(NodeType.StyleBinding, () => {
      const styleBindingNode = statement as StyleBindingTreeNode;
      if (!styleBindingNode.StyleTagList.Position) return [];
      return [
        {
          type: ContextScenarioType.StyleArgList,
          from: styleBindingNode.StyleTagList.Position.from,
          to: styleBindingNode.StyleTagList.Position.to,
        },
      ];
    })
    .otherwise(() => []);
}

export function makeASTCompletionIndex(
  recipeNode: RecipeTreeNode,
): ASTCompletionIndex {
  const tokenRecords = recipeNode.Statements.flatMap(makeTokenRecords);
  const contextScenarios: ContextScenario[] =
    recipeNode.Statements.flatMap(makeContextScenarios);

  return new ASTCompletionIndex(tokenRecords, contextScenarios);
}
