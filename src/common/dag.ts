export interface DagNode {
  id: string
  name: string
}

export interface DagEdge {
  id: string
  name: string
  srcNodeId: string
  destNodeId: string
}

export type NodeNamePair = [ string, string ]

export class Dag {
  private nodeMap: Map<string, DagNode>
  private edgeMap: Map<string, DagEdge>

  constructor(
    nodeMap: Map<string, DagNode> = new Map(),
    edgeMap: Map<string, DagEdge> = new Map()
  ) {
    this.nodeMap = nodeMap
    this.edgeMap = edgeMap
  }

  addNode(node: DagNode): void {
    this.nodeMap.set(node.id, node)
  }

  addEdge(edge: DagEdge): void {
    if (!this.nodeMap.has(edge.srcNodeId)) {
      console.log("Source node id not found ", edge.srcNodeId)
      return
    }
    if (!this.nodeMap.has(edge.destNodeId)) {
      console.log("Destination node id not found ", edge.destNodeId)
      return
    }
    this.edgeMap.set(edge.id, edge)
  }

  getNodeNameList(): Array<string> {
    return Array.from(this.nodeMap.values())
            .map(node => node.name)
            .sort()
  }

  getEdgeNamesList(): Array<NodeNamePair> {
    return Array.from(this.edgeMap.values())
            .map(edge => [
              this.nodeMap.get(edge.srcNodeId)?.name,
              this.nodeMap.get(edge.destNodeId)?.name
            ] as NodeNamePair)
            .sort()
  }

  formatDag(): string {
    let result = ""
    for (const [_, node] of this.nodeMap) {
      result += "Node: " + node.name + "\n"
    }
    for (const [_, edge] of this.edgeMap) {
      result += "Edge: " + this.nodeMap.get(edge.srcNodeId)?.name
                + " -(" + edge.name + ")-> " 
                + this.nodeMap.get(edge.destNodeId)?.name + "\n"
    }
    return result
  }
}