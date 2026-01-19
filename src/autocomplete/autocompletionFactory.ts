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
  ImportTreeNode,
} from "../compiler/ast";
import {
  CompletionIndex,
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

      const scenarios: ContextScenario[] = [];

      // Add specific scenarios from RHS if available (e.g. Call args/styling)
      if (
        assignmentNode.Rhs.Type === NodeType.Call ||
        assignmentNode.Rhs.Type === NodeType.Namespace
      ) {
        scenarios.push(
          ...makeContextScenarios(assignmentNode.Rhs as StatementTreeNode),
        );
      }

      // Determine the end of the "ValueName" context for the RHS itself.
      // If it's a Call or Namespace, we only want to complete the name,
      // so we stop at the args or styling to avoid shadowing inner scenarios.
      let valueNameEnd = assignmentNode.Rhs.Position.to;

      if (assignmentNode.Rhs.Type === NodeType.Call) {
        const callNode = assignmentNode.Rhs as CallTreeNode;
        if (callNode.ArgList?.Position) {
          valueNameEnd = callNode.ArgList.Position.from;
        } else if (callNode.Styling?.Position) {
          valueNameEnd = callNode.Styling.Position.from;
        }
      } else if (assignmentNode.Rhs.Type === NodeType.Namespace) {
        const nsNode = assignmentNode.Rhs as NamespaceTreeNode;
        if (nsNode.StatementList?.Position) {
          valueNameEnd = nsNode.StatementList.Position.from;
        } else if (nsNode.ArgList?.Position) {
          valueNameEnd = nsNode.ArgList.Position.from;
        } else if (nsNode.Styling?.Position) {
          valueNameEnd = nsNode.Styling.Position.from;
        }
      }

      // Add blanket ValueName scenario for the whole RHS
      scenarios.push({
        type: ContextScenarioType.ValueName,
        from: assignmentNode.Rhs.Position.from,
        to: valueNameEnd,
      });

      return scenarios;
    })
    .with(NodeType.Call, () => {
      const callNode = statement as CallTreeNode;
      const scenarios: ContextScenario[] = [];

      if (callNode.ArgList?.Position) {
        scenarios.push({
          type: ContextScenarioType.ValueName,
          from: callNode.ArgList.Position.from + 1,
          to: callNode.ArgList.Position.to - 1,
        });
      }

      if (callNode.Styling?.Position) {
        scenarios.push({
          type: ContextScenarioType.StyleArgList,
          from: callNode.Styling.Position.from + 1,
          to: callNode.Styling.Position.to - 1,
        });
      }

      return scenarios;
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

type ImportedASTLookup = (path: string) => Promise<RecipeTreeNode | undefined>;

export async function makeNamespaceInfo(
  namespaceNode: NamespaceTreeNode,
  importedASTLookupFn?: ImportedASTLookup,
  visitedImports: Set<string> = new Set(),
): Promise<NamespaceInfo | null> {
  const stmtListPosition = namespaceNode.StatementList?.Position;
  if (!stmtListPosition) return null;

  const statements = namespaceNode.Statements;
  // use makeCompletionIndex so that imports inside the namespace are processed
  const nestedCompletionIndex = await makeCompletionIndex(
    statements,
    importedASTLookupFn,
    visitedImports,
  );
  return {
    name: namespaceNode.Name,
    completionIndex: nestedCompletionIndex,
    startPosition: stmtListPosition.from + 1,
    endPosition: stmtListPosition.to - 1,
  };
}

/**
 * Creates a completion index based ONLY on the declarations in the current list of statements.
 * Does not traverse imports directly (though might through recursive makeCompletionIndex calls).
 */
export async function makeASTCompletionIndex(
  statements: StatementTreeNode[],
  importedASTLookupFn?: ImportedASTLookup,
  visitedImports: Set<string> = new Set(),
): Promise<CompletionIndex> {
  const tokenRecords = statements.flatMap(makeTokenRecords);
  const contextScenarios = statements.flatMap(makeContextScenarios);

  const namespaceInfosNested = await Promise.all(
    statements.map((stmt) =>
      match(stmt.Type)
        .with(NodeType.Namespace, async () => {
          const nsInfo = await makeNamespaceInfo(
            stmt as NamespaceTreeNode,
            importedASTLookupFn,
            visitedImports,
          );
          return nsInfo ? [nsInfo] : [];
        })
        .with(NodeType.Assignment, async () => {
          const assignment = stmt as AssignmentTreeNode;
          if (assignment.Rhs?.Type === NodeType.Namespace) {
            const nsInfo = await makeNamespaceInfo(
              assignment.Rhs as NamespaceTreeNode,
              importedASTLookupFn,
              visitedImports,
            );
            return nsInfo ? [nsInfo] : [];
          }
          return [];
        })
        .otherwise(async () => []),
    ),
  );
  const namespaceInfos = namespaceInfosNested.flat();

  return new CompletionIndex(tokenRecords, contextScenarios, namespaceInfos);
}

async function processImports(
  statements: StatementTreeNode[],
  importedASTLookupFn: ImportedASTLookup,
  visitedImports: Set<string>,
): Promise<CompletionIndex> {
  const tokenRecords: TokenInfo[] = [];
  const namespaceInfos: NamespaceInfo[] = [];

  const importNodes = statements.filter(
    (s) => s.Type === NodeType.Import,
  ) as ImportTreeNode[];

  for (const importNode of importNodes) {
    if (visitedImports.has(importNode.ImportLocation)) continue;

    const importedAst = await importedASTLookupFn(importNode.ImportLocation);
    if (!importedAst) continue;

    const newVisited = new Set(visitedImports);
    newVisited.add(importNode.ImportLocation);

    // Recursive call to full makeCompletionIndex to handle imports inside the imported file
    const importedIndex = await makeCompletionIndex(
      importedAst.Statements,
      importedASTLookupFn,
      newVisited,
    );

    const importStmtEnd = importNode.Position?.to ?? 0;
    const scopeEnd = Infinity;

    // If aliased, it becomes a namespace
    if (importNode.ImportName) {
      namespaceInfos.push({
        name: importNode.ImportName,
        completionIndex: importedIndex,
        startPosition: importStmtEnd,
        endPosition: scopeEnd,
      });
    } else {
      // Flatten tokens and namespaces into current scope
      // Override their endPosition to the import statement's end (token visibility start)
      const newTokens = importedIndex.Tokens.map((t) => ({
        ...t,
        endPosition: importStmtEnd,
      }));
      tokenRecords.push(...newTokens);

      const newNamespaces = importedIndex.Namespaces.map((ns) => ({
        ...ns,
        startPosition: importStmtEnd,
        endPosition: scopeEnd,
      }));
      namespaceInfos.push(...newNamespaces);
    }
  }

  return new CompletionIndex(tokenRecords, [], namespaceInfos);
}

export async function makeCompletionIndex(
  statements: StatementTreeNode[],
  importedASTLookupFn?: ImportedASTLookup,
  visitedImports: Set<string> = new Set(),
): Promise<CompletionIndex> {
  // Get AST based index (local definitions)
  const astIndex = await makeASTCompletionIndex(
    statements,
    importedASTLookupFn,
    visitedImports,
  );

  // If no import lookup function, return AST index directly
  if (!importedASTLookupFn) return astIndex;

  // Get Import based completion data
  const importIndex = await processImports(
    statements,
    importedASTLookupFn,
    visitedImports,
  );

  return new CompletionIndex(
    [...astIndex.Tokens, ...importIndex.Tokens],
    [...astIndex.ContextScenarios, ...importIndex.ContextScenarios],
    [...astIndex.Namespaces, ...importIndex.Namespaces],
  );
}

export async function createCompletionIndex(
  recipeNode: RecipeTreeNode,
  importedASTLookupFn?: ImportedASTLookup,
): Promise<CompletionIndex> {
  return makeCompletionIndex(recipeNode.Statements, importedASTLookupFn);
}
