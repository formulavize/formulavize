import { Puzzlet } from "../lesson";
import { Compilation } from "src/compiler/compilation";
import { Dag } from "src/compiler/dag";
import { normal, fast } from "../animationHelpers";
import { getDagNodesIds, getInEdges, getOutEdges } from "../winCheckHelpers";

const namespacePuzzlets: Puzzlet[] = [
  {
    name: "Using Namespace",
    instructions: [
      normal("ns[ ] is a namespace.\n"),
      normal("Namespaces consist of a word followed by [ ].\n"),
      normal("Namespaces can contain statements inside the [ ].\n"),
      normal("Namespaces without statements are not visualized.\n"),
      normal("Add a function call in the namespace below."),
    ],
    examples: [fast("ns[ ]\n")],
    clearEditorOnStart: true,
    successCondition: (compilation: Compilation) => {
      const childDags = compilation.DAG.getChildDags();
      return childDags.some((childDag) => childDag.getNodeList().length > 0);
    },
  },
  {
    name: "Scope It Out",
    instructions: [
      normal("Namespaces create a new scope for their statements.\n"),
      normal("Variables in a namespace cannot be used outside its scope,\n"),
      normal("unless they are referenced with a qualified name.\n"),
      normal("ns.x is an example of a qualified name.\n"),
      normal("A qualified name is a dot '.' separated name path\n"),
      normal("starting from a namespace in the local scope\n"),
      normal("and ending in a variable in that namespace.\n"),
      normal("Pass the variable in the namespace to the outer function."),
    ],
    examples: [fast("ns[ x = f() ]\n"), fast("g()\n")],
    successCondition: (compilation: Compilation) => {
      const topLevelNodeIds = getDagNodesIds(compilation.DAG);
      const childDags = compilation.DAG.getChildDags();
      const edgeList = compilation.DAG.getEdgeList();

      // Check if there's an edge where source is in a namespace (child DAG)
      // and destination is in the top-level DAG
      return edgeList.some((edge) => {
        const sourceInChildDag = childDags.some((childDag) =>
          getDagNodesIds(childDag).has(edge.srcNodeId),
        );
        const destInTopLevel = topLevelNodeIds.has(edge.destNodeId);
        return sourceInChildDag && destInTopLevel;
      });
    },
  },
  {
    name: "The Edge of Space",
    instructions: [
      normal("Namespaces can take args after the statement list.\n"),
      normal("Namespaces can also be assigned to variables.\n"),
      normal("e.g. var = namespace[ ... ](arg1, arg2)\n"),
      normal("Namespaces themselves cannot be direct arguments to functions\n"),
      normal("but can be passed as a variable.\n"),
      normal("Pass a top-level function to the namespace itself\n"),
      normal("and use a variable to pass the namespace itself to a function."),
    ],
    examples: [
      fast("s = start()\n"),
      fast("n = m[\n"),
      fast("  f()\n"),
      fast("]() // pass s here\n"),
      fast("g() // pass n here\n"),
    ],
    successCondition: (compilation: Compilation) => {
      const topLevelNodeIds = getDagNodesIds(compilation.DAG);
      const childDags = compilation.DAG.getChildDags();
      const edgeList = compilation.DAG.getEdgeList();
      const childDagIds = new Set(childDags.map((dag) => dag.Id));

      const hasEdgeFromTopLevelToNamespace = edgeList.some(
        (edge) =>
          topLevelNodeIds.has(edge.srcNodeId) &&
          childDagIds.has(edge.destNodeId),
      );

      const hasEdgeFromNamespaceToTopLevel = edgeList.some(
        (edge) =>
          childDagIds.has(edge.srcNodeId) &&
          topLevelNodeIds.has(edge.destNodeId),
      );

      return hasEdgeFromTopLevelToNamespace && hasEdgeFromNamespaceToTopLevel;
    },
  },
  {
    name: "Outer Space",
    instructions: [
      normal("Namespaces can be nested inside other namespaces.\n"),
      normal("Reference nested values with a deeper qualified name.\n"),
      normal("Uncomment the assignment and function call below."),
    ],
    examples: [
      fast("outer[\n"),
      fast("  inner[\n"),
      fast("    // x = f()\n"),
      fast("  ]\n"),
      fast("]\n"),
      fast("// g(outer.inner.x)\n"),
    ],
    clearEditorOnStart: true,
    successCondition: (compilation: Compilation) => {
      const childDags = compilation.DAG.getChildDags();
      const topLevelNodeIds = getDagNodesIds(compilation.DAG);
      const edgeList = compilation.DAG.getEdgeList();

      const nestedNodeIds = new Set(
        childDags.flatMap((outerDag) =>
          outerDag
            .getChildDags()
            .flatMap((innerDag) => Array.from(getDagNodesIds(innerDag))),
        ),
      );

      // Check if there's an edge from a nested node to a top-level node
      return edgeList.some(
        (edge) =>
          nestedNodeIds.has(edge.srcNodeId) &&
          topLevelNodeIds.has(edge.destNodeId),
      );
    },
  },
  {
    name: "Space Decor",
    instructions: [
      normal("Namespaces can also have styles in { }.\n"),
      normal("Add a style tag or property to the namespace."),
    ],
    examples: [
      fast('#bg { background-color: "orange" }\n'),
      fast("colored[ f() ](){\n"),
      fast("  //#bg\n"),
      fast("}\n"),
    ],
    successCondition: (compilation: Compilation) => {
      const childDags = compilation.DAG.getChildDags();
      const flattenedStyles = compilation.DAG.getFlattenedStyles();

      return childDags.some((childDag) => {
        // Check if the childDag has direct style properties
        if (childDag.DagStyleProperties.size > 0) {
          return true;
        }

        // Check if the childDag has style tags with properties
        return childDag.DagStyleTags.some((styleTag) => {
          const tagName = styleTag.join(".");
          const properties = flattenedStyles.get(tagName);
          return (properties?.size ?? 0) > 0;
        });
      });
    },
  },
  {
    name: "'Solve By Part' Title",
    instructions: [
      normal("Now you're thinking with namespaces!\n"),
      normal("Let's connect the dots with the code below.\n"),
      normal("Pass each variable to all subsequent functions/namespaces\n"),
      normal("of the opposite color without modifying declaration order."),
    ],
    examples: [
      fast('#o{background-color: "orange"}\n'),
      fast('#b{background-color: "dodgerblue"}\n'),
      fast('#curvy{curve-style: "unbundled-bezier"; line-style: "dotted"}\n'),
      fast("%oA{#curvy}; %bA{#curvy}; %oB{#curvy}; %oN{#curvy}\n"),
      fast("\n"),
      fast("oA = orangeA(){#o}\n"),
      fast("outer[\n"),
      fast("  oN = inner[\n"),
      fast("    bA = blueA(/* 1 orange input */){#b}\n"),
      fast("  ]{#o}\n"),
      fast("  oB = orangeB(/* 1 blue input */){#o}\n"),
      fast("](/* 1 orange input */){#b}\n"),
      fast("blueB(/* 3 orange inputs */){#b}"),
    ],
    clearEditorOnStart: true,
    successCondition: (compilation: Compilation) => {
      const topLevelNodeIds = getDagNodesIds(compilation.DAG);
      const childDags = compilation.DAG.getChildDags();
      const childDagIds = new Set(childDags.map((dag) => dag.Id));

      // Collect edges from all levels (top-level, single-nested, and double-nested)
      const edgeList = [
        ...compilation.DAG.getEdgeList(),
        ...childDags.flatMap((dag) => [
          ...dag.getEdgeList(),
          ...dag.getChildDags().flatMap((nestedDag) => nestedDag.getEdgeList()),
        ]),
      ];

      // Helper to get nodes at a specific nesting level
      function getNestedNodes(dags: Dag[], level: number): Set<string> {
        const current = Array.from({ length: level - 1 }).reduce(
          (dags: Dag[]) => dags.flatMap((dag) => dag.getChildDags()),
          dags,
        );
        return new Set(
          current.flatMap((dag) => Array.from(getDagNodesIds(dag))),
        );
      }

      const singleNestedNodeIds = getNestedNodes(childDags, 1);

      const doubleNestedNodeIds = getNestedNodes(childDags, 2);
      const doubleNestedDagIds = new Set(
        childDags.flatMap((dag) => dag.getChildDags()).map((dag) => dag.Id),
      );
      doubleNestedNodeIds.forEach((nodeId) =>
        singleNestedNodeIds.delete(nodeId),
      );

      function hasNodeWithEdges(
        nodeIds: Set<string>,
        edgeChecker: (nodeId: string) => boolean,
      ): boolean {
        return Array.from(nodeIds).some(edgeChecker);
      }

      return (
        // there is a top-level node with edges to a top-level node,
        // a single-nested namespace, and a double-nested node
        hasNodeWithEdges(topLevelNodeIds, (nodeId) => {
          const outEdges = getOutEdges(nodeId, edgeList);
          return (
            outEdges.some((e) => topLevelNodeIds.has(e.destNodeId)) &&
            outEdges.some((e) => childDagIds.has(e.destNodeId)) &&
            outEdges.some((e) => doubleNestedNodeIds.has(e.destNodeId))
          );
        }) &&
        // there is a double-nested node with an edge from a top-level node
        // and an edge to a single-nested node
        hasNodeWithEdges(doubleNestedNodeIds, (nodeId) => {
          const inEdges = getInEdges(nodeId, edgeList);
          const outEdges = getOutEdges(nodeId, edgeList);
          return (
            inEdges.some((e) => topLevelNodeIds.has(e.srcNodeId)) &&
            outEdges.some((e) => singleNestedNodeIds.has(e.destNodeId))
          );
        }) &&
        // there is a single-nested node with edges from a double-nested node
        // and to a top-level node
        hasNodeWithEdges(singleNestedNodeIds, (nodeId) => {
          const inEdges = getInEdges(nodeId, edgeList);
          const outEdges = getOutEdges(nodeId, edgeList);
          return (
            inEdges.some((e) => doubleNestedNodeIds.has(e.srcNodeId)) &&
            outEdges.some((e) => topLevelNodeIds.has(e.destNodeId))
          );
        }) &&
        // there is a top-level node with edges from a top level node,
        // a single-nested node, and a double-nested namespace
        hasNodeWithEdges(topLevelNodeIds, (nodeId) => {
          const inEdges = getInEdges(nodeId, edgeList);
          return (
            inEdges.some((e) => topLevelNodeIds.has(e.srcNodeId)) &&
            inEdges.some((e) => singleNestedNodeIds.has(e.srcNodeId)) &&
            inEdges.some((e) => doubleNestedDagIds.has(e.srcNodeId))
          );
        })
      );
    },
  },
];

export const namespacesModule = {
  name: "Namespaces",
  puzzlets: namespacePuzzlets,
};
