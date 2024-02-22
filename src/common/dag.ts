export type NodeId = string
export type EdgeId = string
export type ElementId = NodeId | EdgeId
export type StyleTag = string
export type Keyword = string
export type StyleProperties = Map<string, string>

export interface DagElement {
  id: ElementId
  name: string
  styleTags: StyleTag[]
  styleProperties: StyleProperties
}

export interface DagNode extends DagElement {
}

export interface DagEdge extends DagElement {
  srcNodeId: NodeId
  destNodeId: NodeId
}
export class Dag {
  private nodeMap: Map<NodeId, DagNode>
  private edgeMap: Map<EdgeId, DagEdge>
  private flatStyleMap: Map<StyleTag, StyleProperties>
  private styleBinding: Map<Keyword, StyleTag[]>

  constructor(
    nodeMap: Map<NodeId, DagNode> = new Map(),
    edgeMap: Map<EdgeId, DagEdge> = new Map(),
    flatStyleMap: Map<StyleTag, StyleProperties> = new Map(),
    styleBindingMap: Map<Keyword, StyleTag[]> = new Map()
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

  addStyle(styleTag: StyleTag, styleProperties: StyleProperties): void {
    this.flatStyleMap.set(styleTag, styleProperties)
  }

  addStyleBinding(keyword: Keyword, styleTags: StyleTag[]): void {
    this.styleBinding.set(keyword, styleTags)
  }

  getNodeList(): DagNode[] {
    return Array.from(this.nodeMap.values())
  }

  getEdgeList(): DagEdge[] {
    return Array.from(this.edgeMap.values())
  }

  getFlattenedStyles(): Map<StyleTag, StyleProperties> {
    return this.flatStyleMap
  }

  getStyleBindings(): Map<Keyword, StyleTag[]> {
    return this.styleBinding
  }

  formatDag(): string {
    function styleTagDump(styleTagList: StyleTag[]): string {
      let resultDump = ""
      if (styleTagList.length > 0) {
        resultDump = "\n\tStyleTags: [" + styleTagList.toString() + "]"
      }
      return resultDump
    }

    function stylePropertiesDump(styleProperties: StyleProperties): string {
      let resultDump = ""
      if (styleProperties.size > 0) {
        resultDump = "\n\tStyleProperties: "
          + JSON.stringify(Object.fromEntries(styleProperties))
      }
      return resultDump
    }

    let result = ""
    for (const node of this.nodeMap.values()) {
      result += "Node: " + node.name
        + styleTagDump(node.styleTags)
        + stylePropertiesDump(node.styleProperties)
        + "\n"
    }
    for (const edge of this.edgeMap.values()) {
      result += "Edge: " + this.nodeMap.get(edge.srcNodeId)?.name
        + " -(" + edge.name + ")-> " 
        + this.nodeMap.get(edge.destNodeId)?.name
        + styleTagDump(edge.styleTags)
        + stylePropertiesDump(edge.styleProperties)
        + "\n"
    }
    for (const [styleTag, style] of this.flatStyleMap) {
      result += "Style: " + styleTag + stylePropertiesDump(style) + "\n"
    }
    for (const [keyword, styleTags] of this.styleBinding) {
      result += "StyleBinding: " + keyword + styleTagDump(styleTags) + "\n"
    }
    return result
  }
}