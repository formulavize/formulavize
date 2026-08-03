import { Puzzlet } from "../lesson";
import { Compilation } from "src/compiler/compilation";
import { NodeType, AssignmentTreeNode } from "src/compiler/ast";
import { normal, fast, dramatic } from "../animationHelpers";
import {
  getInDegree,
  getOutDegree,
  createNodeIdToVarNameCount,
} from "../winCheckHelpers";

const onAssignmentPuzzlet: Puzzlet = {
  name: "On Assignment",
  instructions: [
    normal("Functions can be assigned to variables using '='.\n"),
    normal("variable_name = function_name()\n"),
    normal("Uncomment the assignment below:"),
  ],
  examples: [fast("// x = f()")],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: "Assign a function output to a variable",
      check: (compilation: Compilation) =>
        compilation.DAG.getVarNameToNodeIdMap().size > 0,
    },
  ],
};

const understandTheAssignmentPuzzlet: Puzzlet = {
  name: "Understand the Assignment",
  instructions: [
    normal("Once assigned, variables can be input to functions.\n"),
    normal("On a new line, input the variable into another function."),
  ],
  examples: [],
  successCriteria: [
    {
      description: "Input an assigned variable to a function",
      check: (compilation: Compilation) => {
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const assignedNodeIds = new Set(varNameToNodeIdMap.values());
        return compilation.DAG.getEdgeList().some((edge) =>
          assignedNodeIds.has(edge.srcNodeId),
        );
      },
    },
  ],
};

const getAssignedVariableUsageCount = (compilation: Compilation): number => {
  const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
  const assignedNodeIds = new Set(varNameToNodeIdMap.values());
  return compilation.DAG.getEdgeList().filter((edge) =>
    assignedNodeIds.has(edge.srcNodeId),
  ).length;
};

const makingAStatementPuzzlet: Puzzlet = {
  name: "Making a Statement",
  instructions: [
    normal("Stand-alone function calls and assignments are statements.\n"),
    normal("There should only be one statement per line,\n"),
    normal("unless separated by a semicolon ';'.\n"),
    normal("Statements are run in the order they appear.\n"),
    normal("Reorder the lines so the variable is assigned before used."),
  ],
  examples: [fast("g(x); h(x)")],
  successCriteria: [
    {
      description: "Use a single variable as input to at least 1 function",
      check: (compilation: Compilation) =>
        getAssignedVariableUsageCount(compilation) >= 1,
    },
    {
      description: "Use a single variable as input to at least 2 functions",
      check: (compilation: Compilation) =>
        getAssignedVariableUsageCount(compilation) >= 2,
    },
  ],
};

const legalAliasesPuzzlet: Puzzlet = {
  name: "Legal Aliases",
  instructions: [
    normal("Variables can be assigned to other variables.\n"),
    normal("The new variable is an alias for the original variable.\n"),
    normal("Uncomment the function calls to use the alias"),
  ],
  examples: [
    fast("long_variable_name = f()\n"),
    fast("alias = long_variable_name\n"),
    fast("// g(long_variable_name); h(alias)"),
  ],
  successCriteria: [
    {
      description: "Assign a variable to another variable (an alias)",
      check: (compilation: Compilation) =>
        compilation.AST.Statements.some((stmt) => {
          if (stmt.Type !== NodeType.Assignment) return false;
          const assignment = stmt as AssignmentTreeNode;
          if (assignment.Lhs.length !== 1) return false;
          return assignment.Rhs?.Type === NodeType.QualifiedVariable;
        }),
    },
    {
      description: "Use the alias as input to a function",
      check: (compilation: Compilation) => {
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const nodeIdToVarNameCount =
          createNodeIdToVarNameCount(varNameToNodeIdMap);
        const edgeList = compilation.DAG.getEdgeList();
        return Array.from(nodeIdToVarNameCount.entries()).some(
          ([nodeId, count]) =>
            count >= 2 && getOutDegree(nodeId, edgeList) >= 2,
        );
      },
    },
  ],
};

const doTheSplitsPuzzlet: Puzzlet = {
  name: "Do the Splits",
  instructions: [
    normal("Multiple variables can be assigned in one statement.\n"),
    normal("Separate the variables with a comma ',' like x, y, z = f()\n"),
    normal("Uncomment the assignment below:"),
  ],
  examples: [
    fast("// yolk, white = split(egg())\n"),
    fast("whisk(yolk); whip(white)\n"),
  ],
  successCriteria: [
    {
      description: "Create a multi-variable assignment",
      check: (compilation: Compilation) =>
        compilation.AST.Statements.some((stmt) => {
          if (stmt.Type !== NodeType.Assignment) return false;
          const assignment = stmt as AssignmentTreeNode;
          return assignment.Lhs.length >= 2;
        }),
    },
    {
      description: "Use the parallelly assigned variables as inputs",
      check: (compilation: Compilation) => {
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const nodeIdToVarNameCount =
          createNodeIdToVarNameCount(varNameToNodeIdMap);
        const edgeList = compilation.DAG.getEdgeList();
        return Array.from(nodeIdToVarNameCount.entries()).some(
          ([nodeId, count]) =>
            count >= 2 && getOutDegree(nodeId, edgeList) >= 2,
        );
      },
    },
  ],
};

const aceOfDiamondsPuzzlet: Puzzlet = {
  name: "Ace of Diamonds",
  instructions: [
    normal("Formulas form DAGs (Directed Acyclic Graphs).\n"),
    ...dramatic("FUNCTION IS NODE"),
    ...dramatic("ARG IS EDGE"),
    ...dramatic("CODER IS YOU!"),
    normal("Make a 4-node diamond-shaped DAG to continue."),
  ],
  examples: [],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: "Create a top node (0 in, 2 out)",
      check: (compilation: Compilation) => {
        const edgeList = compilation.DAG.getEdgeList();
        return compilation.DAG.getNodeList().some(
          (node) =>
            getInDegree(node.id, edgeList) === 0 &&
            getOutDegree(node.id, edgeList) === 2,
        );
      },
    },
    {
      description: "Create a side node (1 in, 1 out)",
      check: (compilation: Compilation) => {
        const edgeList = compilation.DAG.getEdgeList();
        return compilation.DAG.getNodeList().some(
          (node) =>
            getInDegree(node.id, edgeList) === 1 &&
            getOutDegree(node.id, edgeList) === 1,
        );
      },
    },
    {
      description: "Create 2 side nodes (1 in, 1 out)",
      check: (compilation: Compilation) => {
        const edgeList = compilation.DAG.getEdgeList();
        const sideNodeCount = compilation.DAG.getNodeList().filter(
          (node) =>
            getInDegree(node.id, edgeList) === 1 &&
            getOutDegree(node.id, edgeList) === 1,
        ).length;
        return sideNodeCount === 2;
      },
    },
    {
      description: "Create a bottom node (2 in, 0 out)",
      check: (compilation: Compilation) => {
        const edgeList = compilation.DAG.getEdgeList();
        return compilation.DAG.getNodeList().some(
          (node) =>
            getInDegree(node.id, edgeList) === 2 &&
            getOutDegree(node.id, edgeList) === 0,
        );
      },
    },
    {
      description: "Create exactly 4 nodes and 4 edges",
      check: (compilation: Compilation) =>
        compilation.DAG.getNodeList().length === 4 &&
        compilation.DAG.getEdgeList().length === 4,
    },
  ],
};

export const assignmentModule = {
  name: "Assignment",
  puzzlets: [
    onAssignmentPuzzlet,
    understandTheAssignmentPuzzlet,
    makingAStatementPuzzlet,
    legalAliasesPuzzlet,
    doTheSplitsPuzzlet,
    aceOfDiamondsPuzzlet,
  ],
};
