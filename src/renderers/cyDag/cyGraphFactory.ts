import { EdgeDefinition, ElementsDefinition, NodeDefinition } from "cytoscape";
import { Dag } from "../../compiler/dag";

export function makeCyNodes(dag: Dag): NodeDefinition[] {
  return dag.getNodeList().map((node) => ({
    data: {
      id: node.id,
      name: node.name,
      ...(dag.Parent && { parent: dag.Id }),
      ...(dag.LineagePath && { lineagePath: dag.LineagePath }),
    },
    ...(node.styleTags.length > 0 && {
      classes: node.styleTags.join(" "),
    }),
  }));
}

export function makeCyEdges(dag: Dag): EdgeDefinition[] {
  return dag.getEdgeList().map((edge) => ({
    data: {
      id: edge.id,
      source: edge.srcNodeId,
      target: edge.destNodeId,
      name: edge.name,
      ...(dag.LineagePath && { lineagePath: dag.LineagePath }),
    },
    ...(edge.styleTags.length > 0 && {
      classes: edge.styleTags.join(" "),
    }),
  }));
}

function makeCyCompoundNode(dag: Dag): NodeDefinition {
  const parent = dag.Parent;
  return {
    data: {
      id: dag.Id,
      name: dag.Name,
      ...(parent && parent.Parent && { parent: parent.Id }),
      ...(dag.DagLineagePath && { lineagePath: dag.DagLineagePath }),
    },
    ...(dag.DagStyleTags.length > 0 && {
      classes: dag.DagStyleTags.join(" "),
    }),
  };
}

// order is a list of insertion-order indices from root to node, e.g. [2, 0, 1].
// Lexicographic comparison preserves hierarchical ordering for dagre's sort.
export function makeCyElements(
  dag: Dag,
  parentOrderPath: number[] = [],
): ElementsDefinition {
  const insertionOrder = dag.getElementInsertionOrder();

  const nodeList: NodeDefinition[] = makeCyNodes(dag).map((node) => ({
    ...node,
    data: {
      ...node.data,
      order: [
        ...parentOrderPath,
        insertionOrder.get(node.data.id as string) ?? 0,
      ],
    },
  }));

  const edgeList = makeCyEdges(dag);

  for (const childDag of dag.getChildDags()) {
    const childPath = [
      ...parentOrderPath,
      insertionOrder.get(childDag.Id) ?? 0,
    ];
    const childElements = makeCyElements(childDag, childPath);
    nodeList.push(...childElements.nodes);
    edgeList.push(...childElements.edges);
  }

  if (dag.Parent && nodeList.length > 0) {
    const compoundNode = makeCyCompoundNode(dag);
    compoundNode.data = {
      ...compoundNode.data,
      order: parentOrderPath,
    };
    nodeList.push(compoundNode);
  }

  return { nodes: nodeList, edges: edgeList };
}
