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

export function makeCyElements(dag: Dag): ElementsDefinition {
  const nodeList = makeCyNodes(dag);
  const edgeList = makeCyEdges(dag);

  const childElements = dag.getChildDags().map(makeCyElements);
  nodeList.push(...childElements.flatMap((elementDefs) => elementDefs.nodes));
  edgeList.push(...childElements.flatMap((elementDefs) => elementDefs.edges));

  if (dag.Parent && nodeList.length > 0) {
    nodeList.push(makeCyCompoundNode(dag));
  }

  return { nodes: nodeList, edges: edgeList };
}
