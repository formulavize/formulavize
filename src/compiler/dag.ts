export type NodeId = string;
export type EdgeId = string;
export type DagId = string;
export type ElementId = NodeId | EdgeId;
export type QualifiableIdentifier = string[];
export type StyleTag = QualifiableIdentifier;
export type Keyword = string;
export type StyleProperties = Map<string, string>;

export interface DagElement {
  id: ElementId;
  name: string;
  styleTags: StyleTag[];
  styleProperties: StyleProperties;
}

export type DagNode = DagElement;

export interface DagEdge extends DagElement {
  srcNodeId: NodeId;
  destNodeId: NodeId;
}

export interface DagStyle {
  styleTags: StyleTag[];
  styleProperties: StyleProperties;
}

export class Dag {
  private id: DagId;
  private parent: Dag | null;
  private name: string;
  private nodeMap: Map<NodeId, DagNode>;
  private edgeMap: Map<EdgeId, DagEdge>;
  private varNameToNodeId: Map<string, NodeId>;
  private varNameToStyleNode: Map<string, DagStyle | null>;
  private styleTagNameToFlatStyleMap: Map<string, StyleProperties>;
  private styleBinding: Map<Keyword, StyleTag[]>;
  private childDags: Map<DagId, Dag>;
  private namespaceNameToDagId: Map<string, DagId>;
  private lineagePath: string;
  private dagLineagePath: string;
  private dagStyleTags: StyleTag[];
  private dagStyleProperties: StyleProperties;
  private usedImports: Set<string>;

  constructor(
    id: DagId,
    parent: Dag | null = null,
    name: string = "",
    dagStyleTags: StyleTag[] = [],
    dagStyleProperties: StyleProperties = new Map(),
  ) {
    this.id = id;
    this.parent = parent;
    this.name = name;
    this.dagStyleTags = dagStyleTags;
    this.dagStyleProperties = dagStyleProperties;
    this.nodeMap = new Map();
    this.edgeMap = new Map();
    this.varNameToNodeId = new Map();
    this.varNameToStyleNode = new Map();
    this.styleTagNameToFlatStyleMap = new Map();
    this.styleBinding = new Map();
    this.childDags = new Map();
    this.namespaceNameToDagId = new Map();
    if (parent !== null) {
      parent.addChildDag(this);
    }
    this.lineagePath = this.getLineagePath();
    this.dagLineagePath = this.getDagLineagePath();
    this.usedImports = new Set();
  }

  addNode(node: DagNode): void {
    this.nodeMap.set(node.id, node);
  }

  addEdge(edge: DagEdge): void {
    this.edgeMap.set(edge.id, edge);
  }

  addStyleBinding(keyword: Keyword, styleTags: StyleTag[]): void {
    this.styleBinding.set(keyword, styleTags);
  }

  addChildDag(childDag: Dag): void {
    this.childDags.set(childDag.id, childDag);
    if (childDag.name) {
      this.namespaceNameToDagId.set(childDag.name, childDag.id);
    }
    childDag.Parent = this;
  }

  addUsedImport(usedImport: string): void {
    this.usedImports.add(usedImport);
  }

  private resolveFromMember<K extends keyof Dag, V>(
    memberName: K,
    idPart: string,
  ): V | null | undefined {
    // Resolve the idPart from the member of the current dag
    const memberValue = this[memberName];
    if (!(memberValue instanceof Map)) return undefined;
    return memberValue.get(idPart) as V;
  }

  private resolveQualifiedIdentifierInCurScope<K extends keyof Dag, V>(
    qualifiedIdentifier: QualifiableIdentifier,
    memberName: K,
  ): V | null | undefined {
    // Resolve the qualified identifier in the current scope
    if (qualifiedIdentifier.length === 0) return undefined;

    const [first, ...rest] = qualifiedIdentifier;
    if (rest.length === 0) {
      return this.resolveFromMember(memberName, first) as V;
    }

    const childDagId = this.namespaceNameToDagId.get(first);
    if (!childDagId) return undefined;
    return this.childDags
      .get(childDagId)
      ?.resolveQualifiedIdentifierInCurScope(rest, memberName);
  }

  private resolveQualifiedIdentifier<K extends keyof Dag, V>(
    qualifiedIdentifier: QualifiableIdentifier,
    memberName: K,
    seenDags: Set<DagId> = new Set(),
  ): V | null | undefined {
    // Resolve the qualified identifier in the current scope and parent scopes
    // with inner dags taking precedence over outer dags
    // null is returned if the identifier is found but the value is null
    // undefined is returned if the identifier is not found
    if (this.id in seenDags) {
      // this should never happen in practice
      console.warn("Cycle detected in the DAG lineage, stopping traversal");
      return undefined;
    }
    seenDags.add(this.id);
    const resolvedValue = this.resolveQualifiedIdentifierInCurScope(
      qualifiedIdentifier,
      memberName,
    );
    if (resolvedValue) return resolvedValue as V;
    if (resolvedValue === null) return null;
    return this.parent?.resolveQualifiedIdentifier(
      qualifiedIdentifier,
      memberName,
      seenDags,
    );
  }

  getVarNode(varName: QualifiableIdentifier): NodeId | null | undefined {
    const varNameMember = "varNameToNodeId" as keyof Dag;
    return this.resolveQualifiedIdentifier(varName, varNameMember);
  }

  getVarStyle(varName: QualifiableIdentifier): DagStyle | null | undefined {
    const varStyleMember = "varNameToStyleNode" as keyof Dag;
    return this.resolveQualifiedIdentifier(varName, varStyleMember);
  }

  getStyle(styleTag: StyleTag): StyleProperties | null | undefined {
    const styleTagMember = "styleTagNameToFlatStyleMap" as keyof Dag;
    return this.resolveQualifiedIdentifier(styleTag, styleTagMember);
  }

  setVarNode(varName: string, nodeId: NodeId): void {
    this.varNameToNodeId.set(varName, nodeId);
  }

  setVarStyle(varName: string, styleNode: DagStyle | null): void {
    this.varNameToStyleNode.set(varName, styleNode);
  }

  setStyle(styleTagName: string, styleProperties: StyleProperties): void {
    this.styleTagNameToFlatStyleMap.set(styleTagName, styleProperties);
  }

  get Id(): DagId {
    return this.id;
  }

  set Id(newId: DagId) {
    const oldId = this.id;
    this.id = newId;
    this.lineagePath = this.getLineagePath();
    this.dagLineagePath = this.getDagLineagePath();

    if (!this.parent) return;
    this.parent.childDags.delete(oldId);
    this.parent.childDags.set(this.id, this);
    if (!this.name) return;
    this.parent.namespaceNameToDagId.set(this.name, this.id);
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

  set Name(newName: string) {
    const oldName = this.name;
    this.name = newName;

    if (!this.parent) return;
    this.parent.namespaceNameToDagId.delete(oldName);
    if (!this.name) return;
    this.parent.namespaceNameToDagId.set(this.name, this.id);
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

  get UsedImports(): Set<string> {
    return this.usedImports;
  }

  getNodeList(): DagNode[] {
    return Array.from(this.nodeMap.values());
  }

  getEdgeList(): DagEdge[] {
    return Array.from(this.edgeMap.values());
  }

  getDagAsDagNode(): DagNode {
    return {
      id: this.id,
      name: this.name,
      styleTags: this.dagStyleTags,
      styleProperties: this.dagStyleProperties,
    };
  }

  getFlattenedStyles(): Map<string, StyleProperties> {
    // callers may rely on style insertion order
    return this.styleTagNameToFlatStyleMap;
  }

  getStyleBindings(): Map<Keyword, StyleTag[]> {
    return this.styleBinding;
  }

  getChildDags(): Dag[] {
    return Array.from(this.childDags.values());
  }

  getVarNameToNodeIdMap(): Map<string, NodeId> {
    return this.varNameToNodeId;
  }

  getVarNameToStyleNodeMap(): Map<string, DagStyle | null> {
    return this.varNameToStyleNode;
  }

  private getLineageIdsAscending(): DagId[] {
    // Return a list of dag ids from the current dag to the root dag
    // e.g. [currentDagId, parentDagId, rootDagId ]
    const lineageIds: DagId[] = [];
    const visitedDags: Set<DagId> = new Set();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let currentDag: Dag | null = this;
    while (currentDag) {
      if (visitedDags.has(currentDag.id)) {
        console.warn("Cycle detected in the DAG lineage, stopping traversal");
        break;
      }
      visitedDags.add(currentDag.id);
      lineageIds.push(currentDag.id);
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

  mergeDag(dag: Dag): void {
    // Merge the input dag into the current dag
    dag.getNodeList().forEach((node) => {
      this.addNode(node);
    });
    dag.getEdgeList().forEach((edge) => {
      this.addEdge(edge);
    });
    dag.getFlattenedStyles().forEach((style, styleTag) => {
      this.setStyle(styleTag, style);
    });
    dag.getStyleBindings().forEach((styleTags, keyword) => {
      this.addStyleBinding(keyword, styleTags);
    });
    dag.getVarNameToNodeIdMap().forEach((nodeId, varName) => {
      this.setVarNode(varName, nodeId);
    });
    dag.getVarNameToStyleNodeMap().forEach((styleNode, varName) => {
      this.setVarStyle(varName, styleNode);
    });
    dag.getChildDags().forEach((childDag) => {
      this.addChildDag(childDag);
    });
    dag.UsedImports.forEach((usedImport) => {
      this.addUsedImport(usedImport);
    });
  }

  debugDumpDag(level: number = 0): string {
    const leftPad = "\t".repeat(level);
    const childLeftPad = leftPad + "\t";
    const grandchildLeftPad = childLeftPad + "\t";

    function styleTagDump(styleTagList: StyleTag[]): string {
      function styleTagListToString(styleTags: StyleTag[]): string {
        return styleTags.map((styleTag) => `${styleTag.join(".")}`).join(", ");
      }
      return styleTagList.length > 0
        ? `\n${grandchildLeftPad}StyleTags: [${styleTagListToString(styleTagList)}]`
        : "";
    }

    function stylePropertiesDump(styleProperties: StyleProperties): string {
      return styleProperties.size > 0
        ? `\n${grandchildLeftPad}StyleProperties: ${JSON.stringify(Object.fromEntries(styleProperties))}`
        : "";
    }

    let result = leftPad + "Dag: " + this.name + "\n";
    this.UsedImports.forEach((usedImport) => {
      result += childLeftPad + "Import: " + usedImport + "\n";
    });
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
    this.styleTagNameToFlatStyleMap.forEach((style, styleTag) => {
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
      result += subDag.debugDumpDag(level + 1);
    });

    return result;
  }
}
