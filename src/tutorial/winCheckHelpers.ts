import { DagElement, DagEdge, Dag } from "src/compiler/dag";

// Helper function to get edges coming into a node by ID
export function getInEdges(nodeId: string, edgeList: DagEdge[]): DagEdge[] {
  return edgeList.filter((edge) => edge.destNodeId === nodeId);
}

// Helper function to get edges going out of a node by ID
export function getOutEdges(nodeId: string, edgeList: DagEdge[]): DagEdge[] {
  return edgeList.filter((edge) => edge.srcNodeId === nodeId);
}

// Helper function to get in-degree of a node by ID
export function getInDegree(nodeId: string, edgeList: DagEdge[]): number {
  return getInEdges(nodeId, edgeList).length;
}

// Helper function to get out-degree of a node by ID
export function getOutDegree(nodeId: string, edgeList: DagEdge[]): number {
  return getOutEdges(nodeId, edgeList).length;
}

// Helper function to create a map of node IDs to variable name counts
export function createNodeIdToVarNameCount(
  varNameToNodeIdMap: Map<string, string>,
): Map<string, number> {
  const nodeIdToVarNameCount = new Map<string, number>();
  varNameToNodeIdMap.forEach((nodeId) => {
    nodeIdToVarNameCount.set(
      nodeId,
      (nodeIdToVarNameCount.get(nodeId) ?? 0) + 1,
    );
  });
  return nodeIdToVarNameCount;
}

// Helper function to get nodes that use at least one style tag with properties
export function getStyleTaggedNodes(
  flattenedStyles: Map<string, Map<string, string>>,
  nodes: DagElement[],
): DagElement[] {
  return nodes.filter((node) => {
    return node.styleTags.some((tag) => {
      const tagKey = tag.join(".");
      const properties = flattenedStyles.get(tagKey);
      if (!properties) return false;
      return properties.size > 0;
    });
  });
}

// Helper function to get all node IDs in a DAG
export function getDagNodesIds(dag: Dag): Set<string> {
  return new Set(dag.getNodeList().map((n) => n.id));
}
