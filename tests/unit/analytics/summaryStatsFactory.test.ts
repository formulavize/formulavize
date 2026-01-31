import { describe, test, expect } from "vitest";
import { Dag, DagEdge, DagNode } from "src/compiler/dag";
import { Compilation } from "src/compiler/compilation";
import { createSummaryStats } from "src/analytics/summaryStatsFactory";
import {
  RecipeTreeNode,
  CallTreeNode,
  QualifiedVarTreeNode,
  ValueListTreeNode,
  NamespaceTreeNode,
  StatementListTreeNode,
} from "src/compiler/ast";
import { DEFAULT_POSITION } from "src/compiler/compilationErrors";
import { parseFromSource } from "src/compiler/driver";

function createCompilation(dag: Dag): Compilation {
  const emptyAst = new RecipeTreeNode([], DEFAULT_POSITION);
  return new Compilation("", emptyAst, dag, []);
}

function makeNode(
  id: string,
  name: string,
  styleTags: string[][] = [],
  styleProperties: Map<string, string> = new Map(),
): DagNode {
  return {
    id,
    name,
    styleTags,
    styleProperties,
  };
}

function makeEdge(
  id: string,
  name: string,
  srcNodeId: string,
  destNodeId: string,
  styleTags: string[][] = [],
  styleProperties: Map<string, string> = new Map(),
): DagEdge {
  return {
    id,
    name,
    srcNodeId,
    destNodeId,
    styleTags,
    styleProperties,
  };
}

describe("createSummaryStats", () => {
  test("empty dag returns zero stats", () => {
    const dag = new Dag("root");
    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats).toMatchObject({
      structural: {
        nodeCount: 0,
        edgeCount: 0,
        maxNestingDepth: 0,
        totalChildDags: 0,
        avgOutDegree: 0,
        avgInDegree: 0,
        maxOutDegree: 0,
        maxInDegree: 0,
      },
      namespace: {
        namespaceCount: 0,
        maxNamespaceDepth: 0,
        avgNamespaceDepth: 0,
      },
      styling: {
        totalStyleTagCount: 0,
        totalStylePropertyCount: 0,
        avgStyleTagsPerElement: 0,
        avgStylePropertiesPerElement: 0,
        styleBindingCount: 0,
        inlineStyleCount: 0,
        taggedStyleCount: 0,
      },
      variable: {
        variableDeclarationCount: 0,
        styleVariableDeclarationCount: 0,
        qualifiedStyleUsageCount: 0,
        maxQualifiedStylePartLength: 0,
        avgQualifiedStylePartLength: 0,
      },
      imports: {
        importCount: 0,
        uniqueImportCount: 0,
      },
      naming: {
        namedEdgeCount: 0,
        unnamedEdgeCount: 0,
        avgNodeNameLength: 0,
        avgEdgeNameLength: 0,
      },
    });
  });

  test("dag with single node", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "test"));
    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.structural.nodeCount).toBe(1);
    expect(stats.structural.edgeCount).toBe(0);
    expect(stats.naming.avgNodeNameLength).toBe(4); // "test".length
  });

  test("dag with multiple nodes", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "a"));
    dag.addNode(makeNode("node2", "bb"));
    dag.addNode(makeNode("node3", "ccc"));
    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.structural.nodeCount).toBe(3);
    expect(stats.naming.avgNodeNameLength).toBe(2); // (1 + 2 + 3) / 3
  });

  test("dag with single edge", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "source"));
    dag.addNode(makeNode("node2", "target"));
    dag.addEdge(makeEdge("edge1", "myEdge", "node1", "node2"));
    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.structural.edgeCount).toBe(1);
    expect(stats.naming.namedEdgeCount).toBe(1);
    expect(stats.naming.unnamedEdgeCount).toBe(0);
    expect(stats.naming.avgEdgeNameLength).toBe(6); // "myEdge".length
  });

  test("dag with named and unnamed edges", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1"));
    dag.addNode(makeNode("node2", "n2"));
    dag.addNode(makeNode("node3", "n3"));
    dag.addEdge(makeEdge("edge1", "namedEdge", "node1", "node2"));
    dag.addEdge(makeEdge("edge2", "", "node2", "node3"));
    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.structural.edgeCount).toBe(2);
    expect(stats.naming.namedEdgeCount).toBe(1);
    expect(stats.naming.unnamedEdgeCount).toBe(1);
    expect(stats.naming.avgEdgeNameLength).toBe(9); // "namedEdge".length
  });

  test("fan-out calculation", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "source"));
    dag.addNode(makeNode("node2", "target1"));
    dag.addNode(makeNode("node3", "target2"));
    // node1 has fan-out of 2, node2 and node3 each have fan-in of 1
    dag.addEdge(makeEdge("edge1", "", "node1", "node2"));
    dag.addEdge(makeEdge("edge2", "", "node1", "node3"));
    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.structural.maxInDegree).toBe(1); // node2 and node3 each have in-degree of 1
    expect(stats.structural.maxOutDegree).toBe(2); // node1 has out-degree of 2
    expect(stats.structural.avgInDegree).toBeCloseTo(2 / 3); // 2 edges to 3 nodes
    expect(stats.structural.avgOutDegree).toBeCloseTo(2 / 3); // 2 edges from 3 nodes
  });

  test("child dag nesting depth", () => {
    const root = new Dag("root");
    const child1 = new Dag("child1", root, "c1");
    const child2 = new Dag("child2", child1, "c2");
    const _child3 = new Dag("child3", child2, "c3");

    const compilation = createCompilation(root);
    const stats = createSummaryStats(compilation);

    expect(stats.structural.maxNestingDepth).toBe(3);
    expect(stats.structural.totalChildDags).toBe(3);
  });

  test("multiple child dags at same level", () => {
    const root = new Dag("root");
    const child1 = new Dag("child1", root, "c1");
    const _child2 = new Dag("child2", root, "c2");
    const _grandchild1 = new Dag("gc1", child1, "gc1");

    const compilation = createCompilation(root);
    const stats = createSummaryStats(compilation);

    expect(stats.structural.maxNestingDepth).toBe(2);
    expect(stats.structural.totalChildDags).toBe(3);
  });

  test("namespace stats with named child dags", () => {
    const root = new Dag("root");
    const child1 = new Dag("child1", root, "namespace1");
    const _child2 = new Dag("child2", child1, "namespace2");
    const _child3 = new Dag("child3", root, "namespace3");

    const compilation = createCompilation(root);
    const stats = createSummaryStats(compilation);

    expect(stats.namespace.namespaceCount).toBe(3);
    expect(stats.namespace.maxNamespaceDepth).toBe(2); // root -> child1 -> child2
    expect(stats.namespace.avgNamespaceDepth).toBeCloseTo((1 + 2 + 1) / 3);
  });

  test("namespace stats excludes unnamed child dags", () => {
    const root = new Dag("root");
    const _child1 = new Dag("child1", root, "named");
    const _child2 = new Dag("child2", root, ""); // unnamed

    const compilation = createCompilation(root);
    const stats = createSummaryStats(compilation);

    expect(stats.namespace.namespaceCount).toBe(1);
    expect(stats.namespace.maxNamespaceDepth).toBe(1);
  });

  test("style tags on nodes", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1", [["tag1"], ["tag2"]]));
    dag.addNode(makeNode("node2", "n2", [["tag3"]]));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.styling.totalStyleTagCount).toBe(3);
    expect(stats.styling.taggedStyleCount).toBe(2); // 2 nodes have tags
    expect(stats.styling.avgStyleTagsPerElement).toBeCloseTo(3 / 3); // 3 tags / 3 elements (2 nodes + 1 dag)
  });

  test("style properties on nodes", () => {
    const dag = new Dag("root");
    dag.addNode(
      makeNode(
        "node1",
        "n1",
        [],
        new Map([
          ["color", "red"],
          ["size", "10"],
        ]),
      ),
    );
    dag.addNode(makeNode("node2", "n2", [], new Map([["shape", "circle"]])));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.styling.totalStylePropertyCount).toBe(3);
    expect(stats.styling.inlineStyleCount).toBe(2);
    expect(stats.styling.avgStylePropertiesPerElement).toBeCloseTo(3 / 3);
  });

  test("style tags on edges", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1"));
    dag.addNode(makeNode("node2", "n2"));
    dag.addEdge(makeEdge("edge1", "e1", "node1", "node2", [["edgeStyle"]]));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.styling.totalStyleTagCount).toBe(1);
    expect(stats.styling.taggedStyleCount).toBe(1);
  });

  test("style tags on dag itself", () => {
    const dag = new Dag(
      "root",
      null,
      "",
      [["dagTag1"], ["dagTag2"]],
      new Map([["dagProp", "value"]]),
    );

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.styling.totalStyleTagCount).toBe(2);
    expect(stats.styling.totalStylePropertyCount).toBe(1);
    expect(stats.styling.taggedStyleCount).toBe(1);
    expect(stats.styling.inlineStyleCount).toBe(1);
  });

  test("style bindings", () => {
    const dag = new Dag("root");
    dag.addStyleBinding("keyword1", [["style", "tag1"]]);
    dag.addStyleBinding("keyword2", [["style", "tag2"]]);

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.styling.styleBindingCount).toBe(2);
  });

  test("variable declarations", () => {
    const dag = new Dag("root");
    dag.setVarNode("var1", "node1");
    dag.setVarNode("var2", "node2");
    dag.setVarNode("var3", "node3");

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.variable.variableDeclarationCount).toBe(3);
  });

  test("style variable declarations", () => {
    const dag = new Dag("root");
    dag.setVarStyle("styleVar1", {
      styleTags: [["tag1"]],
      styleProperties: new Map(),
    });
    dag.setVarStyle("styleVar2", null);

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.variable.styleVariableDeclarationCount).toBe(2);
  });

  test("qualified style usage", () => {
    const dag = new Dag("root");
    dag.addNode(
      makeNode("node1", "n1", [
        ["a", "b"],
        ["x", "y", "z"],
      ]),
    );

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.variable.qualifiedStyleUsageCount).toBe(2);
    expect(stats.variable.maxQualifiedStylePartLength).toBe(3);
    expect(stats.variable.avgQualifiedStylePartLength).toBeCloseTo((2 + 3) / 2);
  });

  test("qualified style usage ignores single-part tags", () => {
    const dag = new Dag("root");
    dag.addNode(
      makeNode("node1", "n1", [
        ["singleTag"], // length 1 - should be ignored
        ["qualified", "tag"], // length 2 - should be counted
      ]),
    );

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.variable.qualifiedStyleUsageCount).toBe(1);
    expect(stats.variable.maxQualifiedStylePartLength).toBe(2);
  });

  test("import stats", () => {
    const dag = new Dag("root");
    dag.addUsedImport("import1");
    dag.addUsedImport("import2");
    dag.addUsedImport("import1"); // duplicate - Set will ignore

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    // Since addUsedImport uses a Set, duplicates are automatically removed
    expect(stats.imports.importCount).toBe(2);
    expect(stats.imports.uniqueImportCount).toBe(2);
  });

  test("imports in child dags are counted", () => {
    const root = new Dag("root");
    root.addUsedImport("import1");
    const child = new Dag("child", root, "child");
    child.addUsedImport("import2");
    child.addUsedImport("import1"); // duplicate across dags

    const compilation = createCompilation(root);
    const stats = createSummaryStats(compilation);

    expect(stats.imports.importCount).toBe(3);
    expect(stats.imports.uniqueImportCount).toBe(2);
  });

  test("elements count includes nodes, edges, and dag itself", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1", [["tag1"]]));
    dag.addNode(makeNode("node2", "n2", []));
    dag.addEdge(makeEdge("edge1", "e1", "node1", "node2"));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    // Total elements: 2 nodes + 1 edge + 1 dag = 4
    // But only 1 has a tag, so avgStyleTagsPerElement = 1 / 4
    expect(stats.styling.avgStyleTagsPerElement).toBeCloseTo(1 / 4);
  });

  test("deep nesting with multiple branches", () => {
    const root = new Dag("root");
    const branch1 = new Dag("b1", root, "branch1");
    const branch1child = new Dag("b1c", branch1, "b1child");
    const _branch1grandchild = new Dag("b1gc", branch1child, "b1grandchild");

    const branch2 = new Dag("b2", root, "branch2");
    const _branch2child = new Dag("b2c", branch2, "b2child");

    const compilation = createCompilation(root);
    const stats = createSummaryStats(compilation);

    expect(stats.structural.maxNestingDepth).toBe(3); // root -> b1 -> b1c -> b1gc
    expect(stats.structural.totalChildDags).toBe(5);
    expect(stats.namespace.namespaceCount).toBe(5);
  });
});

describe("edge cases", () => {
  test("dag with zero-length node names", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", ""));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.naming.avgNodeNameLength).toBe(0);
  });

  test("only unnamed edges", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1"));
    dag.addNode(makeNode("node2", "n2"));
    dag.addEdge(makeEdge("edge1", "", "node1", "node2"));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.naming.namedEdgeCount).toBe(0);
    expect(stats.naming.unnamedEdgeCount).toBe(1);
    expect(stats.naming.avgEdgeNameLength).toBe(0);
  });

  test("edge with whitespace-only name is treated as unnamed", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1"));
    dag.addNode(makeNode("node2", "n2"));
    dag.addEdge(makeEdge("edge1", "   ", "node1", "node2"));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.naming.namedEdgeCount).toBe(0);
    expect(stats.naming.unnamedEdgeCount).toBe(1);
  });

  test("no qualified styles when all tags are single-part", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1", [["tag1"], ["tag2"], ["tag3"]]));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.variable.qualifiedStyleUsageCount).toBe(0);
    expect(stats.variable.maxQualifiedStylePartLength).toBe(0);
    expect(stats.variable.avgQualifiedStylePartLength).toBe(0);
  });

  test("empty style tags array", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1", []));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.styling.totalStyleTagCount).toBe(0);
    expect(stats.styling.taggedStyleCount).toBe(0);
  });

  test("empty style properties map", () => {
    const dag = new Dag("root");
    dag.addNode(makeNode("node1", "n1", []));

    const compilation = createCompilation(dag);
    const stats = createSummaryStats(compilation);

    expect(stats.styling.totalStylePropertyCount).toBe(0);
    expect(stats.styling.inlineStyleCount).toBe(0);
  });
});

describe("AST statistics", () => {
  function createCompilationWithAst(ast: RecipeTreeNode): Compilation {
    const dag = new Dag("root");
    return new Compilation("", ast, dag, []);
  }

  test("empty AST returns base stats", () => {
    const ast = new RecipeTreeNode([], DEFAULT_POSITION);
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    expect(stats.ast).toMatchObject({
      totalNodeCount: 1, // Recipe node itself
      maxAstDepth: 1,
      leafNodeCount: 1,
      avgChildrenPerNode: 0,
      nodeTypeCount: { Recipe: 1 },
    });
  });

  test("AST with single statement", () => {
    const varNode = new QualifiedVarTreeNode(["x"], DEFAULT_POSITION);
    const ast = new RecipeTreeNode([varNode], DEFAULT_POSITION);
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    expect(stats.ast.totalNodeCount).toBe(2); // Recipe + QVar
    expect(stats.ast.maxAstDepth).toBe(2);
    expect(stats.ast.leafNodeCount).toBe(1); // QVar has no children
    expect(stats.ast.avgChildrenPerNode).toBeCloseTo(1 / 2); // Recipe has 1 child, QVar has 0
  });

  test("AST with assignment", () => {
    const { ast } = parseFromSource("x = y");
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    // Recipe -> Assignment -> (LocalVar, QVar)
    expect(stats.ast.totalNodeCount).toBe(4);
    expect(stats.ast.maxAstDepth).toBe(3);
    expect(stats.ast.leafNodeCount).toBe(2); // LocalVar and QVar
    expect(stats.ast.avgChildrenPerNode).toBeCloseTo(3 / 4); // 3 children total / 4 nodes
  });

  test("AST with function call", () => {
    const arg = new QualifiedVarTreeNode(["x"], DEFAULT_POSITION);
    const argList = new ValueListTreeNode([arg], DEFAULT_POSITION);
    const call = new CallTreeNode("myFunc", argList, null, DEFAULT_POSITION);
    const ast = new RecipeTreeNode([call], DEFAULT_POSITION);
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    // Recipe -> Call -> ArgList -> QVar
    expect(stats.ast.totalNodeCount).toBe(4);
    expect(stats.ast.maxAstDepth).toBe(4);
    expect(stats.ast.leafNodeCount).toBe(1); // Only QVar is a leaf
  });

  test("AST with multiple statements", () => {
    const var1 = new QualifiedVarTreeNode(["a"], DEFAULT_POSITION);
    const var2 = new QualifiedVarTreeNode(["b"], DEFAULT_POSITION);
    const var3 = new QualifiedVarTreeNode(["c"], DEFAULT_POSITION);
    const ast = new RecipeTreeNode([var1, var2, var3], DEFAULT_POSITION);
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    expect(stats.ast.totalNodeCount).toBe(4); // Recipe + 3 QVars
    expect(stats.ast.maxAstDepth).toBe(2);
    expect(stats.ast.leafNodeCount).toBe(3);
    expect(stats.ast.avgChildrenPerNode).toBeCloseTo(3 / 4); // Recipe has 3 children
  });

  test("AST with namespace", () => {
    const innerVar = new QualifiedVarTreeNode(["x"], DEFAULT_POSITION);
    const stmtList = new StatementListTreeNode([innerVar], DEFAULT_POSITION);
    const namespace = new NamespaceTreeNode(
      "ns",
      stmtList,
      null,
      null,
      DEFAULT_POSITION,
    );
    const ast = new RecipeTreeNode([namespace], DEFAULT_POSITION);
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    // Recipe -> Namespace -> StatementList -> QVar
    expect(stats.ast.totalNodeCount).toBe(4);
    expect(stats.ast.maxAstDepth).toBe(4);
    expect(stats.ast.leafNodeCount).toBe(1); // Only QVar
  });

  test("AST with nested namespace", () => {
    const innerVar = new QualifiedVarTreeNode(["z"], DEFAULT_POSITION);
    const innerStmtList = new StatementListTreeNode(
      [innerVar],
      DEFAULT_POSITION,
    );
    const innerNamespace = new NamespaceTreeNode(
      "inner",
      innerStmtList,
      null,
      null,
      DEFAULT_POSITION,
    );

    const outerStmtList = new StatementListTreeNode(
      [innerNamespace],
      DEFAULT_POSITION,
    );
    const outerNamespace = new NamespaceTreeNode(
      "outer",
      outerStmtList,
      null,
      null,
      DEFAULT_POSITION,
    );

    const ast = new RecipeTreeNode([outerNamespace], DEFAULT_POSITION);
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    // Recipe -> Namespace(outer) -> StatementList -> Namespace(inner) -> StatementList -> Variable
    expect(stats.ast.totalNodeCount).toBe(6);
    expect(stats.ast.maxAstDepth).toBe(6);
    expect(stats.ast.leafNodeCount).toBe(1);
  });

  test("AST node type counting", () => {
    const { ast } = parseFromSource("x = a; b");
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    expect(stats.ast.nodeTypeCount).toMatchObject({
      Recipe: 1,
      Assignment: 1,
      LocalVariable: 1,
      QualifiedVariable: 2,
    });
  });

  test("AST with mixed structure", () => {
    const { ast } = parseFromSource("x = y(); z()");
    const compilation = createCompilationWithAst(ast);
    const stats = createSummaryStats(compilation);

    // Recipe -> (Assignment, Call)
    // Assignment -> (LocalVar, Call)
    // Call -> ValueList -> QVar
    // Call -> ValueList
    expect(stats.ast.totalNodeCount).toBe(7);
    expect(stats.ast.leafNodeCount).toBe(3); // LocalVar, QVar, empty ValueList
  });
});

describe("Source code statistics", () => {
  function createCompilationWithSource(source: string): Compilation {
    const dag = new Dag("root");
    const ast = new RecipeTreeNode([], DEFAULT_POSITION);
    return new Compilation(source, ast, dag, []);
  }

  test("empty source returns zero stats", () => {
    const compilation = createCompilationWithSource("");
    const stats = createSummaryStats(compilation);

    expect(stats.source).toMatchObject({
      totalCharacterCount: 0,
      lineCount: 1, // Empty string split by '\n' gives one line
      avgLineLength: 0,
      maxLineLength: 0,
    });
  });

  test("single line source", () => {
    const compilation = createCompilationWithSource("x = 5");
    const stats = createSummaryStats(compilation);

    expect(stats.source).toMatchObject({
      totalCharacterCount: 5,
      lineCount: 1,
      avgLineLength: 5,
      maxLineLength: 5,
    });
  });

  test("multi-line source with equal length lines", () => {
    const source = "abc\ndef\nghi";
    const compilation = createCompilationWithSource(source);
    const stats = createSummaryStats(compilation);

    expect(stats.source).toMatchObject({
      totalCharacterCount: 11, // 3 + 1 + 3 + 1 + 3
      lineCount: 3,
      avgLineLength: 3, // (3 + 3 + 3) / 3
      maxLineLength: 3,
    });
  });

  test("multi-line source with varying line lengths", () => {
    const source = "a\nbb\nccc\ndddd";
    const compilation = createCompilationWithSource(source);
    const stats = createSummaryStats(compilation);

    expect(stats.source).toMatchObject({
      totalCharacterCount: 13, // 1 + 1 + 2 + 1 + 3 + 1 + 4
      lineCount: 4,
      avgLineLength: 2.5, // (1 + 2 + 3 + 4) / 4
      maxLineLength: 4,
    });
  });

  test("source with only newlines", () => {
    const source = "\n\n\n";
    const compilation = createCompilationWithSource(source);
    const stats = createSummaryStats(compilation);

    expect(stats.source).toMatchObject({
      totalCharacterCount: 3,
      lineCount: 4, // 4 empty lines
      avgLineLength: 0,
      maxLineLength: 0,
    });
  });

  test("source with trailing newline", () => {
    const source = "line1\nline2\n";
    const compilation = createCompilationWithSource(source);
    const stats = createSummaryStats(compilation);

    expect(stats.source).toMatchObject({
      totalCharacterCount: 12,
      lineCount: 3, // "line1", "line2", ""
      avgLineLength: 10 / 3, // (5 + 5 + 0) / 3
      maxLineLength: 5,
    });
  });

  test("source with tabs and special characters", () => {
    const source = "a\tb\nc\rd";
    const compilation = createCompilationWithSource(source);
    const stats = createSummaryStats(compilation);

    expect(stats.source.totalCharacterCount).toBe(7);
    expect(stats.source.lineCount).toBe(2);
  });
});
