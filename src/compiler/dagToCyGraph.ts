import { EdgeDefinition, ElementsDefinition, NodeDefinition } from "cytoscape";
import { TOP_LEVEL_DAG_ID } from "./constants";
import { Dag } from "./dag";

export function makeCyNodes(dag: Dag): NodeDefinition[] {
  return dag.getNodeList().map((node) => ({
    data: {
      id: node.id,
      name: node.name,
      ...(dag.Id !== TOP_LEVEL_DAG_ID && { parent: dag.Id }),
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
  const parentId = dag.Parent?.Id;
  return {
    data: {
      id: dag.Id,
      name: dag.Name,
      ...(parentId && parentId !== TOP_LEVEL_DAG_ID && { parent: parentId }),
      ...(dag.DagLineagePath && { lineagePath: dag.DagLineagePath }),
    },
    ...(dag.DagStyleTags.length > 0 && {
      classes: dag.DagStyleTags.join(" "),
    }),
  };
}

export function makeCyElements(dag: Dag): ElementsDefinition {
  const nodeList = makeCyNodes(dag);
  const edgeList = makeCyEdges(dag);

  const childElements = dag.getChildDags().map(makeCyElements);
  nodeList.push(...childElements.flatMap((elementDefs) => elementDefs.nodes));
  edgeList.push(...childElements.flatMap((elementDefs) => elementDefs.edges));

  if (dag.Id !== TOP_LEVEL_DAG_ID && nodeList.length > 0) {
    nodeList.push(makeCyCompoundNode(dag));
  }

  return { nodes: nodeList, edges: edgeList };
}
