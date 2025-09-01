import { match } from "ts-pattern";
import {
  RecipeTreeNode,
  StatementTreeNode,
  NodeType,
  AssignmentTreeNode,
  CallTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
  NamespaceTreeNode,
} from "./ast";
import {
  ASTCompletionIndex,
  TokenInfo,
  TokenType,
  ContextScenarioType,
  ContextScenario,
  NamespaceInfo,
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
    .with(NodeType.Namespace, () => {
      const namespaceNode = statement as NamespaceTreeNode;
      return [
        {
          type: TokenType.Namespace,
          value: namespaceNode.Name,
          endPosition: namespaceNode.Position?.to ?? 0,
        },
      ];
    })
    .otherwise(() => []);
}

function makeContextScenarios(statement: StatementTreeNode): ContextScenario[] {
  return match(statement.Type)
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
          from: namedStyleNode.StyleNode.Position.from + 1,
          to: namedStyleNode.StyleNode.Position.to - 1,
        },
      ];
    })
    .with(NodeType.StyleBinding, () => {
      const styleBindingNode = statement as StyleBindingTreeNode;
      if (!styleBindingNode.StyleTagList?.Position) return [];
      return [
        {
          type: ContextScenarioType.StyleArgList,
          from: styleBindingNode.StyleTagList.Position.from + 1,
          to: styleBindingNode.StyleTagList.Position.to - 1,
        },
      ];
    })
    .with(NodeType.Namespace, () => {
      const namespaceNode = statement as NamespaceTreeNode;
      const scenarios: ContextScenario[] = [];
      if (namespaceNode.ArgList?.Position) {
        scenarios.push({
          type: ContextScenarioType.ValueName,
          from: namespaceNode.ArgList.Position.from + 1,
          to: namespaceNode.ArgList.Position.to - 1,
        });
      }
      if (namespaceNode.Styling?.Position) {
        scenarios.push({
          type: ContextScenarioType.StyleArgList,
          from: namespaceNode.Styling.Position.from + 1,
          to: namespaceNode.Styling.Position.to - 1,
        });
      }
      return scenarios;
    })
    .otherwise(() => []);
}

export function makeNamespaceInfo(
  namespaceNode: NamespaceTreeNode,
): NamespaceInfo | null {
  const stmtListPosition = namespaceNode.StatementList?.Position;
  if (!stmtListPosition) return null;

  const statements = namespaceNode.Statements;
  const nestedCompletionIndex = makeASTCompletionIndex(statements);
  return {
    name: namespaceNode.Name,
    completionIndex: nestedCompletionIndex,
    startPosition: stmtListPosition.from + 1,
    endPosition: stmtListPosition.to - 1,
  };
}

export function makeASTCompletionIndex(
  statements: StatementTreeNode[],
): ASTCompletionIndex {
  const tokenRecords = statements.flatMap(makeTokenRecords);
  const contextScenarios = statements.flatMap(makeContextScenarios);
  const namespaceInfos = statements
    .filter((stmt) => stmt.Type === NodeType.Namespace)
    .map((stmt) => makeNamespaceInfo(stmt as NamespaceTreeNode))
    .filter(Boolean) as NamespaceInfo[];

  return new ASTCompletionIndex(tokenRecords, contextScenarios, namespaceInfos);
}

export function createASTCompletionIndex(
  recipeNode: RecipeTreeNode,
): ASTCompletionIndex {
  return makeASTCompletionIndex(recipeNode.Statements);
}
