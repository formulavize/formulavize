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

  abstract formatValue(): string;

  abstract isComplete(): boolean;

  formatTree(): string {
    const formatTreeHelper = (node: BaseTreeNode, lvl: number): string => {
      return (
        `${node.formatValue()}\n` +
        node
          .getChildren()
          .map(
            (child) => "\t".repeat(lvl + 1) + formatTreeHelper(child, lvl + 1),
          )
          .join("")
      );
    };
    return formatTreeHelper(this, 0);
  }
}

export type StatementTreeNode =
  | CallTreeNode
  | QualifiedVarTreeNode
  | AssignmentTreeNode
  | AliasTreeNode
  | NamedStyleTreeNode
  | StyleBindingTreeNode
  | NamespaceTreeNode;

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

  formatValue(): string {
    return "Recipe:";
  }

  isComplete(): boolean {
    return true;
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

  formatValue(): string {
    return "Call: " + this.name;
  }

  isComplete(): boolean {
    return this.name !== "";
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
  private rhs: CallTreeNode | null;

  constructor(varList: LocalVarTreeNode[], call: CallTreeNode | null) {
    super(NodeType.Assignment);
    this.lhs = varList;
    this.rhs = call;
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = this.lhs;
    if (this.rhs) childList.push(this.rhs);
    return childList;
  }

  formatValue(): string {
    return "Assignment:";
  }

  isComplete(): boolean {
    return this.lhs.length > 0 && this.rhs !== null;
  }

  get Lhs(): LocalVarTreeNode[] {
    return this.lhs;
  }

  get Rhs(): CallTreeNode | null {
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

  formatValue(): string {
    return "Alias:";
  }

  isComplete(): boolean {
    return this.lhs !== null && this.rhs !== null;
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

  formatValue(): string {
    return "LocalVariable: " + this.varName;
  }

  isComplete(): boolean {
    return this.varName !== "";
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

  formatValue(): string {
    return "QualifiedVariable: " + this.qualifiedVarName.join(".");
  }

  isComplete(): boolean {
    return this.qualifiedVarName.length > 0;
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

  formatValue(): string {
    const styleTagListStr = this.styleTagList
      .map((tag) => tag.join("."))
      .join(", ");
    const keyValueMapStr = JSON.stringify(Object.fromEntries(this.keyValueMap));
    return (
      `StyleTagList: [${styleTagListStr}] ` +
      `StyleKeyValueMap: ${keyValueMapStr}`
    );
  }

  isComplete(): boolean {
    return true;
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

  formatValue(): string {
    return "StyleName: " + this.styleName;
  }

  isComplete(): boolean {
    return true;
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

  formatValue(): string {
    const styleTagListStr = this.styleTagList
      .map((tag) => tag.join("."))
      .join(", ");
    return (
      `StyleBinding: ${this.keyword} ` + `StyleTagList: [${styleTagListStr}]`
    );
  }

  isComplete(): boolean {
    return true;
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

  formatValue(): string {
    return "Namespace: " + this.name;
  }

  isComplete(): boolean {
    return true;
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
