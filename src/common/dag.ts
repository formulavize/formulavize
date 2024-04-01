export type NodeId = string;
export type EdgeId = string;
export type DagId = string;
export type ElementId = NodeId | EdgeId;
export type StyleTag = string;
export type Keyword = string;
export type StyleProperties = Map<string, string>;

export interface DagElement {
  id: ElementId;
  name: string;
  styleTags: StyleTag[];
  styleProperties: StyleProperties;
}

export interface DagNode extends DagElement {}

export interface DagEdge extends DagElement {
  srcNodeId: NodeId;
  destNodeId: NodeId;
}

export class Dag {
  private id: DagId;
  private parent: Dag | null;
  private name: string;
  private nodeMap: Map<NodeId, DagNode>;
  private edgeMap: Map<EdgeId, DagEdge>;
  private flatStyleMap: Map<StyleTag, StyleProperties>;
  private styleBinding: Map<Keyword, StyleTag[]>;
  private childDags: Map<DagId, Dag>;

  constructor(
    id: DagId,
    parent: Dag | null = null,
    name: string = "",
    nodeMap: Map<NodeId, DagNode> = new Map(),
    edgeMap: Map<EdgeId, DagEdge> = new Map(),
    flatStyleMap: Map<StyleTag, StyleProperties> = new Map(),
    styleBindingMap: Map<Keyword, StyleTag[]> = new Map(),
    childDags: Map<DagId, Dag> = new Map(),
  ) {
    this.id = id;
    this.parent = parent;
    this.name = name;
    this.nodeMap = nodeMap;
    this.edgeMap = edgeMap;
    this.flatStyleMap = flatStyleMap;
    this.styleBinding = styleBindingMap;
    this.childDags = childDags;
  }

  addNode(node: DagNode): void {
    this.nodeMap.set(node.id, node);
  }

  addEdge(edge: DagEdge): void {
    if (!this.nodeMap.has(edge.srcNodeId)) {
      console.log("Source node id not found ", edge.srcNodeId);
      return;
    }
    if (!this.nodeMap.has(edge.destNodeId)) {
      console.log("Destination node id not found ", edge.destNodeId);
      return;
    }
    this.edgeMap.set(edge.id, edge);
  }

  addStyle(styleTag: StyleTag, styleProperties: StyleProperties): void {
    this.flatStyleMap.set(styleTag, styleProperties);
  }

  addStyleBinding(keyword: Keyword, styleTags: StyleTag[]): void {
    this.styleBinding.set(keyword, styleTags);
  }

  addChildDag(childDag: Dag): void {
    this.childDags.set(childDag.id, childDag);
  }

  getNodeList(): DagNode[] {
    return Array.from(this.nodeMap.values());
  }

  getEdgeList(): DagEdge[] {
    return Array.from(this.edgeMap.values());
  }

  getFlattenedStyles(): Map<StyleTag, StyleProperties> {
    return this.flatStyleMap;
  }

  getStyleBindings(): Map<Keyword, StyleTag[]> {
    return this.styleBinding;
  }

  formatDag(level: number = 0): string {
    const leftPad = "\t".repeat(level);
    const childLeftPad = leftPad + "\t";
    const grandchildLeftPad = childLeftPad + "\t";

    function styleTagDump(styleTagList: StyleTag[]): string {
      return styleTagList.length > 0
        ? `\n${grandchildLeftPad}StyleTags: [${styleTagList.toString()}]`
        : "";
    }

    function stylePropertiesDump(styleProperties: StyleProperties): string {
      return styleProperties.size > 0
        ? `\n${grandchildLeftPad}StyleProperties: ${JSON.stringify(Object.fromEntries(styleProperties))}`
        : "";
    }

    let result = leftPad + "Dag: " + this.name + "\n";
    this.nodeMap.forEach((node) => {
      result +=
        childLeftPad +
        "Node: " +
        node.name +
        styleTagDump(node.styleTags) +
        stylePropertiesDump(node.styleProperties) +
        "\n";
    });
    this.edgeMap.forEach((edge) => {
      result +=
        childLeftPad +
        "Edge: " +
        this.nodeMap.get(edge.srcNodeId)?.name +
        ` -(${edge.name})-> ` +
        this.nodeMap.get(edge.destNodeId)?.name +
        styleTagDump(edge.styleTags) +
        stylePropertiesDump(edge.styleProperties) +
        "\n";
    });
    this.flatStyleMap.forEach((style, styleTag) => {
      result +=
        childLeftPad + "Style: " + styleTag + stylePropertiesDump(style) + "\n";
    });
    this.styleBinding.forEach((styleTags, keyword) => {
      result +=
        childLeftPad +
        "StyleBinding: " +
        keyword +
        styleTagDump(styleTags) +
        "\n";
    });
    this.childDags.forEach((subDag) => {
      result += subDag.formatDag(level + 1);
    });

    return result;
  }
}
