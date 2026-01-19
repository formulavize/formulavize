import { describe, test, expect } from "vitest";
import {
  makeCompletionIndex,
  makeNamespaceInfo,
  createCompletionIndex,
} from "src/autocomplete/autocompletionFactory";
import {
  RecipeTreeNode as Recipe,
  CallTreeNode as Call,
  AssignmentTreeNode as Assignment,
  LocalVarTreeNode as LocalVariable,
  QualifiedVarTreeNode as QualifiedVariable,
  StyleTreeNode as Style,
  NamedStyleTreeNode as NamedStyle,
  StyleBindingTreeNode as StyleBinding,
  StyleTagListTreeNode as StyleTagList,
  NamespaceTreeNode as Namespace,
  ValueListTreeNode as ValueList,
  StatementListTreeNode as StatementList,
} from "src/compiler/ast";
import {
  TokenType,
  ContextScenarioType,
} from "src/autocomplete/autocompletion";
import { Position } from "src/compiler/compilationErrors";

// Helper function to create positions for testing
function pos(from: number, to: number): Position {
  return { from, to };
}

describe("makeCompletionIndex captures tokens", () => {
  test("creates empty index for empty statements", async () => {
    const statements: Assignment[] = [];
    const index = await makeCompletionIndex(statements);

    expect(index.tokens).toEqual([]);
    expect(index.contextScenarios).toEqual([]);
    expect(index.namespaces).toEqual([]);
  });

  test("creates tokens from assignment statements", async () => {
    const varNode = new LocalVariable("myVar");
    const assignmentNode = new Assignment([varNode], null, pos(0, 10));
    const statements = [assignmentNode];

    const index = await makeCompletionIndex(statements);

    expect(index.tokens).toHaveLength(1);
    expect(index.tokens[0]).toEqual({
      type: TokenType.Variable,
      value: "myVar",
      endPosition: 10,
    });
  });

  test("creates tokens from multiple variables in assignment", async () => {
    const var1 = new LocalVariable("var1");
    const var2 = new LocalVariable("var2");
    const assignmentNode = new Assignment([var1, var2], null, pos(0, 15));
    const statements = [assignmentNode];

    const index = await makeCompletionIndex(statements);

    expect(index.tokens).toHaveLength(2);
    expect(index.tokens[0]).toEqual({
      type: TokenType.Variable,
      value: "var1",
      endPosition: 15,
    });
    expect(index.tokens[1]).toEqual({
      type: TokenType.Variable,
      value: "var2",
      endPosition: 15,
    });
  });

  test("creates tokens from named style statements", async () => {
    const styleNode = new Style(new Map(), [], pos(5, 20));
    const namedStyleNode = new NamedStyle("myStyle", styleNode, pos(0, 25));
    const statements = [namedStyleNode];

    const index = await makeCompletionIndex(statements);

    expect(index.tokens).toHaveLength(1);
    expect(index.tokens[0]).toEqual({
      type: TokenType.StyleTag,
      value: "myStyle",
      endPosition: 25,
    });
  });

  test("creates tokens from style binding statements", async () => {
    const styleTagList = new StyleTagList([], pos(10, 20));
    const styleBindingNode = new StyleBinding(
      "keyword",
      styleTagList,
      pos(0, 25),
    );
    const statements = [styleBindingNode];

    const index = await makeCompletionIndex(statements);

    expect(index.tokens).toHaveLength(1);
    expect(index.tokens[0]).toEqual({
      type: TokenType.Keyword,
      value: "keyword",
      endPosition: 25,
    });
  });

  test("creates tokens from namespace statements", async () => {
    const statementList = new StatementList([], pos(10, 30));
    const namespaceNode = new Namespace(
      "myNamespace",
      statementList,
      null,
      null,
      pos(0, 35),
    );
    const statements = [namespaceNode];

    const index = await makeCompletionIndex(statements);

    expect(index.tokens).toHaveLength(1);
    expect(index.tokens[0]).toEqual({
      type: TokenType.Namespace,
      value: "myNamespace",
      endPosition: 35,
    });
  });

  test("ignores statements with unsupported node types", async () => {
    // Create a call node which should not produce tokens in makeTokenRecords
    const callNode = new Call("testFunc", null, null, pos(0, 10));
    const statements = [callNode];

    const index = await makeCompletionIndex(statements);

    expect(index.tokens).toEqual([]);
  });
});

describe("makeCompletionIndex captures context scenarios", () => {
  test("creates context scenario for assignment RHS", async () => {
    const varNode = new LocalVariable("myVar");
    const rhsNode = new QualifiedVariable(["otherVar"], pos(15, 25));
    const assignmentNode = new Assignment([varNode], rhsNode, pos(0, 30));
    const statements = [assignmentNode];

    const index = await makeCompletionIndex(statements);

    expect(index.contextScenarios).toHaveLength(1);
    expect(index.contextScenarios[0]).toEqual({
      type: ContextScenarioType.ValueName,
      from: 15,
      to: 25,
    });
  });

  test("creates context scenario for call arguments", async () => {
    const argList = new ValueList([], pos(10, 20));
    const callNode = new Call("testFunc", argList, null, pos(0, 25));
    const statements = [callNode];

    const index = await makeCompletionIndex(statements);

    expect(index.contextScenarios).toHaveLength(1);
    expect(index.contextScenarios[0]).toEqual({
      type: ContextScenarioType.ValueName,
      from: 11, // argList.from + 1
      to: 19, // argList.to - 1
    });
  });

  test("creates context scenario for named style arguments", async () => {
    const styleNode = new Style(new Map(), [], pos(15, 25));
    const namedStyleNode = new NamedStyle("myStyle", styleNode, pos(0, 30));
    const statements = [namedStyleNode];

    const index = await makeCompletionIndex(statements);

    expect(index.contextScenarios).toHaveLength(1);
    expect(index.contextScenarios[0]).toEqual({
      type: ContextScenarioType.StyleArgList,
      from: 16, // styleNode.from + 1
      to: 24, // styleNode.to - 1
    });
  });

  test("creates context scenario for style binding", async () => {
    const styleTagList = new StyleTagList([], pos(10, 20));
    const styleBindingNode = new StyleBinding(
      "keyword",
      styleTagList,
      pos(0, 25),
    );
    const statements = [styleBindingNode];

    const index = await makeCompletionIndex(statements);

    expect(index.contextScenarios).toHaveLength(1);
    expect(index.contextScenarios[0]).toEqual({
      type: ContextScenarioType.StyleArgList,
      from: 11, // styleTagList.from + 1
      to: 19, // styleTagList.to - 1
    });
  });

  test("creates multiple context scenarios for namespace", async () => {
    const argList = new ValueList([], pos(15, 25));
    const styling = new Style(new Map(), [], pos(30, 40));
    const statementList = new StatementList([], pos(45, 55));
    const namespaceNode = new Namespace(
      "myNamespace",
      statementList,
      argList,
      styling,
      pos(0, 60),
    );
    const statements = [namespaceNode];

    const index = await makeCompletionIndex(statements);

    expect(index.contextScenarios).toHaveLength(2);
    expect(index.contextScenarios).toContainEqual({
      type: ContextScenarioType.ValueName,
      from: 16, // argList.from + 1
      to: 24, // argList.to - 1
    });
    expect(index.contextScenarios).toContainEqual({
      type: ContextScenarioType.StyleArgList,
      from: 31, // styling.from + 1
      to: 39, // styling.to - 1
    });
  });

  test("handles statements with missing positions gracefully", async () => {
    const varNode = new LocalVariable("myVar");
    const assignmentNode = new Assignment([varNode], null); // No position
    const statements = [assignmentNode];

    const index = await makeCompletionIndex(statements);

    expect(index.contextScenarios).toEqual([]);
  });

  test("creates context scenario for call styling", async () => {
    const styling = new Style(new Map(), [], pos(15, 25));
    const callNode = new Call("testFunc", null, styling, pos(0, 30));
    const statements = [callNode];

    const index = await makeCompletionIndex(statements);

    expect(index.contextScenarios).toHaveLength(1);
    expect(index.contextScenarios[0]).toEqual({
      type: ContextScenarioType.StyleArgList,
      from: 16, // styling.from + 1
      to: 24, // styling.to - 1
    });
  });

  test("creates nested context scenarios for assignment with call RHS", async () => {
    const styling = new Style(new Map(), [], pos(20, 30));
    const callNode = new Call("testFunc", null, styling, pos(10, 35));
    const varNode = new LocalVariable("myVar");
    const assignmentNode = new Assignment([varNode], callNode, pos(0, 40));
    const statements = [assignmentNode];

    const index = await makeCompletionIndex(statements);

    // Should have both ValueName (blanket for RHS) and StyleArgList (from Call)
    expect(index.contextScenarios).toHaveLength(2);

    expect(index.contextScenarios).toContainEqual({
      type: ContextScenarioType.ValueName,
      from: 10, // callNode.from
      to: 20, // styling.from (clamped)
    });

    expect(index.contextScenarios).toContainEqual({
      type: ContextScenarioType.StyleArgList,
      from: 21, // styling.from + 1
      to: 29, // styling.to - 1
    });
  });
});

describe("makeCompletionIndex captures namespaces", () => {
  test("creates namespace info for namespace statements", async () => {
    const innerVar = new LocalVariable("innerVar");
    const innerAssignment = new Assignment([innerVar], null, pos(50, 60));
    const statementList = new StatementList([innerAssignment], pos(45, 65));
    const namespaceNode = new Namespace(
      "testNamespace",
      statementList,
      null,
      null,
      pos(0, 70),
    );
    const statements = [namespaceNode];

    const index = await makeCompletionIndex(statements);

    expect(index.namespaces).toHaveLength(1);
    const namespaceInfo = index.namespaces[0];
    expect(namespaceInfo.name).toBe("testNamespace");
    expect(namespaceInfo.startPosition).toBe(46); // statementList.from + 1
    expect(namespaceInfo.endPosition).toBe(64); // statementList.to - 1
    expect(namespaceInfo.completionIndex.tokens).toHaveLength(1);
    expect(namespaceInfo.completionIndex.tokens[0].value).toBe("innerVar");
  });

  test("filters out namespaces with null statement lists", async () => {
    const namespaceNode = new Namespace("testNamespace", null); // No statement list
    const statements = [namespaceNode];

    const index = await makeCompletionIndex(statements);

    expect(index.namespaces).toEqual([]);
  });

  test("creates nested namespace hierarchies", async () => {
    // Create nested namespace structure
    const deepVar = new LocalVariable("deepVar");
    const deepAssignment = new Assignment([deepVar], null, pos(80, 90));
    const deepStatementList = new StatementList([deepAssignment], pos(75, 95));
    const deepNamespace = new Namespace(
      "deepNamespace",
      deepStatementList,
      null,
      null,
      pos(70, 100),
    );

    const midVar = new LocalVariable("midVar");
    const midAssignment = new Assignment([midVar], null, pos(50, 60));
    const midStatementList = new StatementList(
      [midAssignment, deepNamespace],
      pos(45, 105),
    );
    const midNamespace = new Namespace(
      "midNamespace",
      midStatementList,
      null,
      null,
      pos(40, 110),
    );

    const statements = [midNamespace];

    const index = await makeCompletionIndex(statements);

    expect(index.namespaces).toHaveLength(1);
    const midNamespaceInfo = index.namespaces[0];
    expect(midNamespaceInfo.name).toBe("midNamespace");
    expect(midNamespaceInfo.completionIndex.tokens).toHaveLength(2); // midVar + deepNamespace
    expect(
      midNamespaceInfo.completionIndex.tokens.map((t) => t.value),
    ).toContain("midVar");
    expect(
      midNamespaceInfo.completionIndex.tokens.map((t) => t.value),
    ).toContain("deepNamespace");
    expect(midNamespaceInfo.completionIndex.namespaces).toHaveLength(1);

    const deepNamespaceInfo = midNamespaceInfo.completionIndex.namespaces[0];
    expect(deepNamespaceInfo.name).toBe("deepNamespace");
    expect(deepNamespaceInfo.completionIndex.tokens).toHaveLength(1);
    expect(deepNamespaceInfo.completionIndex.tokens[0].value).toBe("deepVar");
  });

  test("captures namespaces from assignment RHS", async () => {
    const innerVar = new LocalVariable("innerVar");
    const innerAssignment = new Assignment([innerVar], null, pos(30, 40));
    const statementList = new StatementList([innerAssignment], pos(25, 45));
    const namespaceNode = new Namespace("rhsNamespace", statementList);

    const varNode = new LocalVariable("nsVar");
    const assignmentNode = new Assignment([varNode], namespaceNode, pos(0, 50));

    const statements = [assignmentNode];
    const index = await makeCompletionIndex(statements);

    expect(index.namespaces).toHaveLength(1);
    const nsInfo = index.namespaces[0];
    expect(nsInfo.name).toBe("rhsNamespace");
    expect(nsInfo.completionIndex.tokens).toHaveLength(1);
    expect(nsInfo.completionIndex.tokens[0].value).toBe("innerVar");
  });
});

describe("makeNamespaceInfo", () => {
  test("creates namespace info with valid statement list", async () => {
    const innerVar = new LocalVariable("testVar");
    const innerAssignment = new Assignment([innerVar], null, pos(20, 30));
    const statementList = new StatementList([innerAssignment], pos(15, 35));
    const namespaceNode = new Namespace("testNamespace", statementList);

    const namespaceInfo = await makeNamespaceInfo(namespaceNode);

    expect(namespaceInfo).not.toBeNull();
    expect(namespaceInfo!.name).toBe("testNamespace");
    expect(namespaceInfo!.startPosition).toBe(16); // statementList.from + 1
    expect(namespaceInfo!.endPosition).toBe(34); // statementList.to - 1
    expect(namespaceInfo!.completionIndex.tokens).toHaveLength(1);
    expect(namespaceInfo!.completionIndex.tokens[0].value).toBe("testVar");
  });

  test("returns null for namespace without statement list", async () => {
    const namespaceNode = new Namespace("testNamespace", null);

    const namespaceInfo = await makeNamespaceInfo(namespaceNode);

    expect(namespaceInfo).toBeNull();
  });

  test("returns null for namespace with statement list without position", async () => {
    const statementList = new StatementList([]); // No position
    const namespaceNode = new Namespace("testNamespace", statementList);

    const namespaceInfo = await makeNamespaceInfo(namespaceNode);

    expect(namespaceInfo).toBeNull();
  });
});

describe("createCompletionIndex", () => {
  test("creates completion index from recipe node", async () => {
    const varNode = new LocalVariable("recipeVar");
    const assignmentNode = new Assignment([varNode], null, pos(0, 15));
    const styleNode = new Style(new Map(), [], pos(20, 30));
    const namedStyleNode = new NamedStyle(
      "recipeStyle",
      styleNode,
      pos(15, 35),
    );
    const recipeNode = new Recipe([assignmentNode, namedStyleNode]);

    const index = await createCompletionIndex(recipeNode);

    expect(index.tokens).toHaveLength(2);
    expect(index.tokens).toContainEqual({
      type: TokenType.Variable,
      value: "recipeVar",
      endPosition: 15,
    });
    expect(index.tokens).toContainEqual({
      type: TokenType.StyleTag,
      value: "recipeStyle",
      endPosition: 35,
    });
  });
});
