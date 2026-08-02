import { Puzzlet } from "../lesson";
import { Compilation } from "src/compiler/compilation";
import { Dag } from "src/compiler/dag";
import { normal, fast } from "../animationHelpers";
import { getDagNodesIds, getInEdges, getOutEdges } from "../winCheckHelpers";

const usingNamespacePuzzlet: Puzzlet = {
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
  successCriteria: [
    {
      description: "Add a function call inside a namespace",
      check: (compilation: Compilation) => {
        const childDags = compilation.DAG.getChildDags();
        return childDags.some((childDag) => childDag.getNodeList().length > 0);
      },
    },
  ],
};

const scopeItOutPuzzlet: Puzzlet = {
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
  successCriteria: [
    {
      description:
        "Pass a namespaced variable to a function outside the namespace",
      check: (compilation: Compilation) => {
        const topLevelNodeIds = getDagNodesIds(compilation.DAG);
        const childDags = compilation.DAG.getChildDags();
        const edgeList = compilation.DAG.getEdgeList();
        return edgeList.some((edge) => {
          const sourceInChildDag = childDags.some((childDag) =>
            getDagNodesIds(childDag).has(edge.srcNodeId),
          );
          const destInTopLevel = topLevelNodeIds.has(edge.destNodeId);
          return sourceInChildDag && destInTopLevel;
        });
      },
    },
  ],
};

const theEdgeOfSpacePuzzlet: Puzzlet = {
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
  successCriteria: [
    {
      description: "Pass a top-level function to the namespace itself",
      check: (compilation: Compilation) => {
        const topLevelNodeIds = getDagNodesIds(compilation.DAG);
        const childDags = compilation.DAG.getChildDags();
        const edgeList = compilation.DAG.getEdgeList();
        const childDagIds = new Set(childDags.map((dag) => dag.Id));
        return edgeList.some(
          (edge) =>
            topLevelNodeIds.has(edge.srcNodeId) &&
            childDagIds.has(edge.destNodeId),
        );
      },
    },
    {
      description: "Use a variable to pass the namespace to a function",
      check: (compilation: Compilation) => {
        const topLevelNodeIds = getDagNodesIds(compilation.DAG);
        const childDags = compilation.DAG.getChildDags();
        const edgeList = compilation.DAG.getEdgeList();
        const childDagIds = new Set(childDags.map((dag) => dag.Id));
        return edgeList.some(
          (edge) =>
            childDagIds.has(edge.srcNodeId) &&
            topLevelNodeIds.has(edge.destNodeId),
        );
      },
    },
  ],
};

const outerSpacePuzzlet: Puzzlet = {
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
  successCriteria: [
    {
      description: "Pass a doubly nested variable to a top-level function",
      check: (compilation: Compilation) => {
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
        return edgeList.some(
          (edge) =>
            nestedNodeIds.has(edge.srcNodeId) &&
            topLevelNodeIds.has(edge.destNodeId),
        );
      },
    },
  ],
};

const spaceDecorPuzzlet: Puzzlet = {
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
  successCriteria: [
    {
      description: "Apply at least 1 style to a namespace",
      check: (compilation: Compilation) => {
        const childDags = compilation.DAG.getChildDags();
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        return childDags.some((childDag) => {
          if (childDag.DagStyleProperties.size > 0) return true;
          return childDag.DagStyleTags.some((styleTag) => {
            const tagName = styleTag.join(".");
            const properties = flattenedStyles.get(tagName);
            return (properties?.size ?? 0) > 0;
          });
        });
      },
    },
  ],
};

const solveByPartPuzzlet: Puzzlet = {
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
  successCriteria: (() => {
    // Shared helper to collect all cross-level edge/node data
    function collectLevelData(compilation: Compilation) {
      const topLevelNodeIds = getDagNodesIds(compilation.DAG);
      const childDags = compilation.DAG.getChildDags();
      const childDagIds = new Set(childDags.map((dag) => dag.Id));
      const edgeList = [
        ...compilation.DAG.getEdgeList(),
        ...childDags.flatMap((dag) => [
          ...dag.getEdgeList(),
          ...dag.getChildDags().flatMap((nestedDag) => nestedDag.getEdgeList()),
        ]),
      ];
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
      return {
        topLevelNodeIds,
        childDagIds,
        singleNestedNodeIds,
        doubleNestedNodeIds,
        doubleNestedDagIds,
        edgeList,
      };
    }

    return [
      {
        description:
          "Connect orangeA to outer, blueA, and blueB with opposite-color inputs",
        check: (compilation: Compilation) => {
          const {
            topLevelNodeIds,
            childDagIds,
            doubleNestedNodeIds,
            edgeList,
          } = collectLevelData(compilation);
          return Array.from(topLevelNodeIds).some((nodeId) => {
            const outEdges = getOutEdges(nodeId, edgeList);
            return (
              outEdges.some((e) => topLevelNodeIds.has(e.destNodeId)) &&
              outEdges.some((e) => childDagIds.has(e.destNodeId)) &&
              outEdges.some((e) => doubleNestedNodeIds.has(e.destNodeId))
            );
          });
        },
      },
      {
        description: "Connect blueA to receive orangeA and pass into orangeB",
        check: (compilation: Compilation) => {
          const {
            topLevelNodeIds,
            singleNestedNodeIds,
            doubleNestedNodeIds,
            edgeList,
          } = collectLevelData(compilation);
          return Array.from(doubleNestedNodeIds).some((nodeId) => {
            const inEdges = getInEdges(nodeId, edgeList);
            const outEdges = getOutEdges(nodeId, edgeList);
            return (
              inEdges.some((e) => topLevelNodeIds.has(e.srcNodeId)) &&
              outEdges.some((e) => singleNestedNodeIds.has(e.destNodeId))
            );
          });
        },
      },
      {
        description: "Connect orangeB to receive blueA and pass into blueB",
        check: (compilation: Compilation) => {
          const {
            topLevelNodeIds,
            singleNestedNodeIds,
            doubleNestedNodeIds,
            edgeList,
          } = collectLevelData(compilation);
          return Array.from(singleNestedNodeIds).some((nodeId) => {
            const inEdges = getInEdges(nodeId, edgeList);
            const outEdges = getOutEdges(nodeId, edgeList);
            return (
              inEdges.some((e) => doubleNestedNodeIds.has(e.srcNodeId)) &&
              outEdges.some((e) => topLevelNodeIds.has(e.destNodeId))
            );
          });
        },
      },
      {
        description:
          "Connect blueB to receive orangeA, orangeB, and inner namespace output",
        check: (compilation: Compilation) => {
          const {
            topLevelNodeIds,
            singleNestedNodeIds,
            doubleNestedDagIds,
            edgeList,
          } = collectLevelData(compilation);
          return Array.from(topLevelNodeIds).some((nodeId) => {
            const inEdges = getInEdges(nodeId, edgeList);
            return (
              inEdges.some((e) => topLevelNodeIds.has(e.srcNodeId)) &&
              inEdges.some((e) => singleNestedNodeIds.has(e.srcNodeId)) &&
              inEdges.some((e) => doubleNestedDagIds.has(e.srcNodeId))
            );
          });
        },
      },
    ];
  })(),
};

export const namespacesModule = {
  name: "Namespaces",
  puzzlets: [
    usingNamespacePuzzlet,
    scopeItOutPuzzlet,
    theEdgeOfSpacePuzzlet,
    outerSpacePuzzlet,
    spaceDecorPuzzlet,
    solveByPartPuzzlet,
  ],
};
