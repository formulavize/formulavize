interface DagElement {
  id: string
  name: string
  styleTags: Array<string>
  styleMap: Map<string, string>
}

export interface DagNode extends DagElement {
}

export interface DagEdge extends DagElement {
  srcNodeId: string
  destNodeId: string
}

export type NodeNamePair = [ string, string ]

export class Dag {
  private nodeMap: Map<string, DagNode>
  private edgeMap: Map<string, DagEdge>
  private flatStyleMap: Map<string, Map<string, string>>
  private styleBinding: Map<string, string[]>

  constructor(
    nodeMap: Map<string, DagNode> = new Map(),
    edgeMap: Map<string, DagEdge> = new Map(),
    flatStyleMap: Map<string, Map<string, string>> = new Map(),
    styleBindingMap: Map<string, string[]> = new Map()
  ) {
    this.nodeMap = nodeMap
    this.edgeMap = edgeMap
    this.flatStyleMap = flatStyleMap
    this.styleBinding = styleBindingMap
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

  addStyle(styleName: string, styleMap: Map<string, string>): void {
    this.flatStyleMap.set(styleName, styleMap)
  }

  addStyleBinding(keyword: string, styleTags: string[]): void {
    this.styleBinding.set(keyword, styleTags)
  }

  getNodeList(): Array<DagNode> {
    return Array.from(this.nodeMap.values())
  }

  getEdgeList(): Array<DagEdge> {
    return Array.from(this.edgeMap.values())
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

  getFlattenedStyles(): Map<string, Map<string, string>> {
    return this.flatStyleMap
  }

  getStyleBindings(): Map<string, string[]> {
    return this.styleBinding
  }

  formatDag(): string {
    function styleTagDump(styleTagList: Array<string>): string {
      let resultDump = ""
      if (styleTagList.length > 0) {
        resultDump = "\n\tStyleTags: [" + styleTagList.toString() + "]"
      }
      return resultDump
    }

    function styleMapDump(styleMap: Map<string, string>): string {
      let resultDump = ""
      if (styleMap.size > 0) {
        resultDump = "\n\tStyleMap: "
          + JSON.stringify(Object.fromEntries(styleMap))
      }
      return resultDump
    }

    let result = ""
    for (const node of this.nodeMap.values()) {
      result += "Node: " + node.name
        + styleTagDump(node.styleTags)
        + styleMapDump(node.styleMap)
        + "\n"
    }
    for (const edge of this.edgeMap.values()) {
      result += "Edge: " + this.nodeMap.get(edge.srcNodeId)?.name
        + " -(" + edge.name + ")-> " 
        + this.nodeMap.get(edge.destNodeId)?.name
        + styleTagDump(edge.styleTags)
        + styleMapDump(edge.styleMap)
        + "\n"
    }
    for (const [styleName, style] of this.flatStyleMap) {
      result += "Style: " + styleName + styleMapDump(style) + "\n"
    }
    for (const [keyword, styleTags] of this.styleBinding) {
      result += "StyleBinding: " + keyword + styleTagDump(styleTags) + "\n"
    }
    return result
  }
}