export type NodeId = string;
export type EdgeId = string;
export type DagId = string;
export type ElementId = NodeId | EdgeId;
export type StyleTag = string[];
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
  private flatStyleMap: Map<string, StyleProperties>;
  private styleBinding: Map<Keyword, StyleTag[]>;
  private childDags: Map<DagId, Dag>;
  private lineagePath: string;
  private dagLineagePath: string;
  private dagStyleTags: StyleTag[];
  private dagStyleProperties: StyleProperties;

  constructor(
    id: DagId,
    parent: Dag | null = null,
    name: string = "",
    dagStyleTags: StyleTag[] = [],
    dagStyleProperties: StyleProperties = new Map(),
    nodeMap: Map<NodeId, DagNode> = new Map(),
    edgeMap: Map<EdgeId, DagEdge> = new Map(),
    flatStyleMap: Map<string, StyleProperties> = new Map(),
    styleBindingMap: Map<Keyword, StyleTag[]> = new Map(),
    childDags: Map<DagId, Dag> = new Map(),
  ) {
    this.id = id;
    this.parent = parent;
    this.name = name;
    this.dagStyleTags = dagStyleTags;
    this.dagStyleProperties = dagStyleProperties;
    this.nodeMap = nodeMap;
    this.edgeMap = edgeMap;
    this.flatStyleMap = flatStyleMap;
    this.styleBinding = styleBindingMap;
    this.childDags = childDags;
    if (parent !== null) {
      parent.addChildDag(this);
    }
    this.lineagePath = this.getLineagePath();
    this.dagLineagePath = this.getDagLineagePath();
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

  addStyle(styleTagName: string, styleProperties: StyleProperties): void {
    this.flatStyleMap.set(styleTagName, styleProperties);
  }

  addStyleBinding(keyword: Keyword, styleTags: StyleTag[]): void {
    this.styleBinding.set(keyword, styleTags);
  }

  addChildDag(childDag: Dag): void {
    this.childDags.set(childDag.id, childDag);
    childDag.Parent = this;
  }

  get Id(): DagId {
    return this.id;
  }

  get Parent(): Dag | null {
    return this.parent;
  }

  set Parent(newParent: Dag) {
    if (this.parent && this.parent.Id !== newParent.Id) {
      console.warn(
        "Overwriting dag",
        this.id,
        "parent",
        this.parent.Id,
        "with new parent",
        newParent.Id,
      );
      this.parent.childDags.delete(this.id);
    }
    this.parent = newParent;
    this.lineagePath = this.getLineagePath();
    this.dagLineagePath = this.getDagLineagePath();
  }

  get Name(): string {
    return this.name;
  }

  get DagStyleTags(): StyleTag[] {
    return this.dagStyleTags;
  }

  get DagStyleProperties(): StyleProperties {
    return this.dagStyleProperties;
  }

  get LineagePath(): string {
    return this.lineagePath;
  }

  get DagLineagePath(): string {
    return this.dagLineagePath;
  }

  getNodeList(): DagNode[] {
    return Array.from(this.nodeMap.values());
  }

  getEdgeList(): DagEdge[] {
    return Array.from(this.edgeMap.values());
  }

  getFlattenedStyles(): Map<string, StyleProperties> {
    return this.flatStyleMap;
  }

  getStyleBindings(): Map<Keyword, StyleTag[]> {
    return this.styleBinding;
  }

  getChildDags(): Dag[] {
    return Array.from(this.childDags.values());
  }

  private getLineageIdsAscending(): DagId[] {
    // Return a list of dag ids from the current dag to the root dag
    // e.g. [currentDagId, parentDagId, rootDagId ]
    const lineageIds: DagId[] = [];
    const visitedDags: Set<DagId> = new Set();
    let currentDag: Dag | null = this;
    while (currentDag) {
      if (visitedDags.has(currentDag.id)) {
        console.warn("Cycle detected in the DAG lineage, stopping traversal");
        break;
      }
      lineageIds.push(currentDag.id);
      visitedDags.add(currentDag.id);
      currentDag = currentDag.parent;
    }
    return lineageIds;
  }

  private getLineagePath(): string {
    // Return a string representation of the lineage path
    // from the sub-root dag to the current dag
    // e.g. "/parentDagId/currentDagId"
    const lineageIds = this.getLineageIdsAscending();
    lineageIds.pop(); // omit the root dag id
    return lineageIds
      .reverse()
      .map((id) => "/" + id)
      .join("");
  }

  private getDagLineagePath(): string {
    // Return the lineage path omitting the current dag id
    return this.getLineagePath().split("/").slice(0, -1).join("/");
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
