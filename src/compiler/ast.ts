export enum NodeType {
  Call,
  Assignment,
  Alias,
  LocalVariable,
  QualifiedVariable,
  Recipe,
  Style,
  NamedStyle,
  StyleBinding,
  Namespace,
  Import,
}

export abstract class BaseTreeNode {
  protected type: NodeType;

  constructor(type: NodeType) {
    this.type = type;
  }

  get Type(): NodeType {
    return this.type;
  }

  abstract getChildren(): BaseTreeNode[];

  abstract debugDump(): string;

  debugDumpTree(): string {
    function debugDumpTreeHelper(node: BaseTreeNode, lvl: number): string {
      return (
        `${node.debugDump()}\n` +
        node
          .getChildren()
          .map(
            (child) =>
              "\t".repeat(lvl + 1) + debugDumpTreeHelper(child, lvl + 1),
          )
          .join("")
      );
    }
    return debugDumpTreeHelper(this, 0);
  }
}

export type StatementTreeNode =
  | CallTreeNode
  | QualifiedVarTreeNode
  | AssignmentTreeNode
  | AliasTreeNode
  | NamedStyleTreeNode
  | StyleBindingTreeNode
  | NamespaceTreeNode
  | ImportTreeNode;

export class RecipeTreeNode extends BaseTreeNode {
  private statements: StatementTreeNode[];

  constructor(init_stmts: StatementTreeNode[] = []) {
    super(NodeType.Recipe);
    this.statements = init_stmts;
  }

  addChild(child: StatementTreeNode): void {
    this.statements.push(child);
  }

  getChildren(): StatementTreeNode[] {
    return this.statements;
  }

  debugDump(): string {
    return "Recipe:";
  }

  get Statements(): StatementTreeNode[] {
    return this.statements;
  }
}

export type ValueTreeNode = CallTreeNode | QualifiedVarTreeNode;

export class CallTreeNode extends BaseTreeNode {
  private name: string;
  private argList: ValueTreeNode[];
  private styling: StyleTreeNode | null;

  constructor(
    name: string,
    argList: ValueTreeNode[],
    styling: StyleTreeNode | null = null,
  ) {
    super(NodeType.Call);
    this.name = name;
    this.argList = argList;
    this.styling = styling;
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = this.argList;
    if (this.styling) childList.push(this.styling);
    return childList;
  }

  debugDump(): string {
    return "Call: " + this.name;
  }

  get Name(): string {
    return this.name;
  }

  get ArgList(): ValueTreeNode[] {
    return this.argList;
  }

  get Styling(): StyleTreeNode | null {
    return this.styling;
  }
}

export class AssignmentTreeNode extends BaseTreeNode {
  private lhs: LocalVarTreeNode[];
  private rhs: CallTreeNode | NamespaceTreeNode | null;

  constructor(
    varList: LocalVarTreeNode[],
    rhs: CallTreeNode | NamespaceTreeNode | null,
  ) {
    super(NodeType.Assignment);
    this.lhs = varList;
    this.rhs = rhs;
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = this.lhs;
    if (this.rhs) childList.push(this.rhs);
    return childList;
  }

  debugDump(): string {
    return "Assignment:";
  }

  get Lhs(): LocalVarTreeNode[] {
    return this.lhs;
  }

  get Rhs(): CallTreeNode | NamespaceTreeNode | null {
    return this.rhs;
  }
}

export class AliasTreeNode extends BaseTreeNode {
  private lhs: LocalVarTreeNode | null;
  private rhs: QualifiedVarTreeNode | null;

  constructor(lhs: LocalVarTreeNode | null, rhs: QualifiedVarTreeNode | null) {
    super(NodeType.Alias);
    this.lhs = lhs;
    this.rhs = rhs;
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = [];
    if (this.lhs) childList.push(this.lhs);
    if (this.rhs) childList.push(this.rhs);
    return childList;
  }

  debugDump(): string {
    return "Alias:";
  }

  get Lhs(): LocalVarTreeNode | null {
    return this.lhs;
  }

  get Rhs(): QualifiedVarTreeNode | null {
    return this.rhs;
  }
}

export type QualifiableIdentifier = string[];

export class LocalVarTreeNode extends BaseTreeNode {
  private varName: string;
  private styling: StyleTreeNode | null;

  constructor(value: string, styling: StyleTreeNode | null = null) {
    super(NodeType.LocalVariable);
    this.varName = value;
    this.styling = styling;
  }

  getChildren(): BaseTreeNode[] {
    return this.styling ? [this.styling] : [];
  }

  debugDump(): string {
    return "LocalVariable: " + this.varName;
  }

  get VarName(): string {
    return this.varName;
  }

  get Styling(): StyleTreeNode | null {
    return this.styling;
  }
}

export class QualifiedVarTreeNode extends BaseTreeNode {
  private qualifiedVarName: QualifiableIdentifier;

  constructor(value: QualifiableIdentifier) {
    super(NodeType.QualifiedVariable);
    this.qualifiedVarName = value;
  }

  getChildren(): BaseTreeNode[] {
    return [];
  }

  debugDump(): string {
    return "QualifiedVariable: " + this.qualifiedVarName.join(".");
  }

  get QualifiedVarName(): QualifiableIdentifier {
    return this.qualifiedVarName;
  }
}

export class StyleTreeNode extends BaseTreeNode {
  private keyValueMap: Map<string, string>;
  private styleTagList: QualifiableIdentifier[];

  constructor(
    initMap: Map<string, string> = new Map(),
    initTags: QualifiableIdentifier[] = [],
  ) {
    super(NodeType.Style);
    this.keyValueMap = initMap;
    this.styleTagList = initTags;
  }

  addKeyValue(key: string, value: string): void {
    this.keyValueMap.set(key, value);
  }

  addStyleTag(styleTag: QualifiableIdentifier): void {
    this.styleTagList.push(styleTag);
  }

  getChildren(): BaseTreeNode[] {
    return [];
  }

  debugDump(): string {
    const styleTagListStr = this.styleTagList
      .map((tag) => tag.join("."))
      .join(", ");
    const keyValueMapStr = JSON.stringify(Object.fromEntries(this.keyValueMap));
    return (
      `StyleTagList: [${styleTagListStr}] ` +
      `StyleKeyValueMap: ${keyValueMapStr}`
    );
  }

  get KeyValueMap(): Map<string, string> {
    return this.keyValueMap;
  }

  get StyleTagList(): QualifiableIdentifier[] {
    return this.styleTagList;
  }
}

export class NamedStyleTreeNode extends BaseTreeNode {
  private styleName: string;
  private styleNode: StyleTreeNode;

  constructor(
    styleName: string = "",
    styleNode: StyleTreeNode = new StyleTreeNode(),
  ) {
    super(NodeType.NamedStyle);
    this.styleName = styleName;
    this.styleNode = styleNode;
  }

  getChildren(): BaseTreeNode[] {
    return [this.styleNode];
  }

  debugDump(): string {
    return "StyleName: " + this.styleName;
  }

  get StyleName(): string {
    return this.styleName;
  }

  get StyleNode(): StyleTreeNode {
    return this.styleNode;
  }
}

export class StyleBindingTreeNode extends BaseTreeNode {
  private keyword: string;
  private styleTagList: QualifiableIdentifier[];

  constructor(
    keyword: string = "",
    styleTagList: QualifiableIdentifier[] = [],
  ) {
    super(NodeType.StyleBinding);
    this.keyword = keyword;
    this.styleTagList = styleTagList;
  }

  getChildren(): BaseTreeNode[] {
    return [];
  }

  debugDump(): string {
    const styleTagListStr = this.styleTagList
      .map((tag) => tag.join("."))
      .join(", ");
    return (
      `StyleBinding: ${this.keyword} ` + `StyleTagList: [${styleTagListStr}]`
    );
  }

  get Keyword(): string {
    return this.keyword;
  }

  get StyleTagList(): QualifiableIdentifier[] {
    return this.styleTagList;
  }
}

export class NamespaceTreeNode extends BaseTreeNode {
  private name: string;
  private statements: StatementTreeNode[];
  private argList: ValueTreeNode[];
  private styling: StyleTreeNode | null;

  constructor(
    name: string = "",
    statements: StatementTreeNode[] = [],
    argList: ValueTreeNode[] = [],
    styling: StyleTreeNode | null = null,
  ) {
    super(NodeType.Namespace);
    this.name = name;
    this.statements = statements;
    this.argList = argList;
    this.styling = styling;
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = this.statements.concat(this.argList);
    if (this.styling) childList.push(this.styling);
    return childList;
  }

  debugDump(): string {
    return "Namespace: " + this.name;
  }

  get Name(): string {
    return this.name;
  }

  get Statements(): StatementTreeNode[] {
    return this.statements;
  }

  get ArgList(): ValueTreeNode[] {
    return this.argList;
  }

  get Styling(): StyleTreeNode | null {
    return this.styling;
  }
}

export class ImportTreeNode extends BaseTreeNode {
  private importLocation: string;
  private importAlias: string | null;

  constructor(importPath: string, importAlias: string | null = null) {
    super(NodeType.Import);
    this.importLocation = importPath;
    this.importAlias = importAlias === "" ? null : importAlias;
  }

  getChildren(): BaseTreeNode[] {
    return [];
  }

  debugDump(): string {
    const aliasString = this.importAlias ? this.importAlias + " " : "";
    return "Import: " + aliasString + this.importLocation;
  }

  get ImportLocation(): string {
    return this.importLocation;
  }

  get ImportAlias(): string | null {
    return this.importAlias;
  }
}
