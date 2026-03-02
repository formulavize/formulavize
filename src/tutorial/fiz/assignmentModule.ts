import { Puzzlet } from "../lesson";
import { Compilation } from "src/compiler/compilation";
import { NodeType, AssignmentTreeNode } from "src/compiler/ast";
import { normal, fast, dramatic } from "../animationHelpers";
import {
  getInDegree,
  getOutDegree,
  createNodeIdToVarNameCount,
} from "../winCheckHelpers";

const assignmentPuzzlets: Puzzlet[] = [
  {
    name: "On Assignment",
    instructions: [
      normal("Functions can be assigned to variables using '='.\n"),
      normal("variable_name = function_name()\n"),
      normal("Uncomment the assignment below:"),
    ],
    examples: [fast("// x = f()")],
    clearEditorOnStart: true,
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getVarNameToNodeIdMap().size > 0;
    },
  },
  {
    name: "Understand the Assignment",
    instructions: [
      normal("Once assigned, variables can be input to functions.\n"),
      normal("On a new line, input the variable into another function."),
    ],
    examples: [],
    successCondition: (compilation: Compilation) => {
      const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
      const assignedNodeIds = new Set(varNameToNodeIdMap.values());
      return compilation.DAG.getEdgeList().some((edge) =>
        assignedNodeIds.has(edge.srcNodeId),
      );
    },
  },
  {
    name: "Making a Statement",
    instructions: [
      normal("Stand-alone function calls and assignments are statements.\n"),
      normal("There should only be one statement per line,\n"),
      normal("unless separated by a semicolon ';'.\n"),
      normal("Statements are run in the order they appear.\n"),
      normal("Reorder the lines so the variable is assigned before used."),
    ],
    examples: [fast("g(x); h(x)")],
    successCondition: (compilation: Compilation) => {
      const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
      const assignedNodeIds = new Set(varNameToNodeIdMap.values());
      return (
        compilation.DAG.getEdgeList().filter((edge) =>
          assignedNodeIds.has(edge.srcNodeId),
        ).length >= 2
      );
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      // Check AST for variable-to-variable assignment
      const hasVariableToVariableAssignment = compilation.AST.Statements.some(
        (stmt) => {
          if (stmt.Type !== NodeType.Assignment) return false;
          const assignment = stmt as AssignmentTreeNode;
          if (assignment.Lhs.length !== 1) return false;
          if (assignment.Rhs?.Type !== NodeType.QualifiedVariable) {
            return false;
          }
          return true;
        },
      );

      // Check DAG for alias usage
      const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
      const nodeIdToVarNameCount =
        createNodeIdToVarNameCount(varNameToNodeIdMap);
      const edgeList = compilation.DAG.getEdgeList();
      const hasAliasUsedInDAG = Array.from(nodeIdToVarNameCount.entries()).some(
        ([nodeId, count]) => count >= 2 && getOutDegree(nodeId, edgeList) >= 2,
      );

      return hasVariableToVariableAssignment && hasAliasUsedInDAG;
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      // Check AST for multi-variable assignment
      const hasMultiVariableAssignment = compilation.AST.Statements.some(
        (stmt) => {
          if (stmt.Type !== NodeType.Assignment) return false;
          const assignment = stmt as AssignmentTreeNode;
          return assignment.Lhs.length >= 2;
        },
      );

      // Check DAG for multiple variables referencing same node
      const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
      const nodeIdToVarNameCount =
        createNodeIdToVarNameCount(varNameToNodeIdMap);
      const edgeList = compilation.DAG.getEdgeList();
      const hasMultipleVarsInDAG = Array.from(
        nodeIdToVarNameCount.entries(),
      ).some(
        ([nodeId, count]) => count >= 2 && getOutDegree(nodeId, edgeList) >= 2,
      );

      return hasMultiVariableAssignment && hasMultipleVarsInDAG;
    },
  },
  {
    name: "Ace of Diamonds",
    instructions: [
      normal("Formulas form DAGs (Directed Acyclic Graphs).\n"),
      ...dramatic("FUNCTION IS NODE"),
      ...dramatic("ARG IS EDGE"),
      ...dramatic("CODER IS YOU!"),
      normal("Make a 4-node diamond DAG to continue."),
    ],
    examples: [],
    clearEditorOnStart: true,
    successCondition: (compilation: Compilation) => {
      const nodeList = compilation.DAG.getNodeList();
      const edgeList = compilation.DAG.getEdgeList();

      if (nodeList.length < 4 || edgeList.length < 4) return false;

      const topNode = nodeList.find(
        (node) =>
          getInDegree(node.id, edgeList) === 0 &&
          getOutDegree(node.id, edgeList) === 2,
      );
      if (!topNode) return false;

      const bottomNode = nodeList.find(
        (node) =>
          getInDegree(node.id, edgeList) === 2 &&
          getOutDegree(node.id, edgeList) === 0,
      );
      if (!bottomNode) return false;

      const middleNodes = nodeList.filter(
        (node) =>
          getInDegree(node.id, edgeList) === 1 &&
          getOutDegree(node.id, edgeList) === 1,
      );
      if (middleNodes.length < 2) return false;

      return middleNodes.every(
        (node) =>
          edgeList.some(
            (e) => e.srcNodeId === topNode.id && e.destNodeId === node.id,
          ) &&
          edgeList.some(
            (e) => e.srcNodeId === node.id && e.destNodeId === bottomNode.id,
          ),
      );
    },
  },
];

export const assignmentModule = {
  name: "Assignment",
  puzzlets: assignmentPuzzlets,
};
