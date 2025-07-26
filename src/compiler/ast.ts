import { Position } from "./compilationErrors";

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
  StyleTag,
  Namespace,
  Import,
}

export abstract class BaseTreeNode {
  protected type: NodeType;
  protected position: Position | null;

  constructor(type: NodeType, position: Position | null = null) {
    this.type = type;
    this.position = position;
  }

  get Type(): NodeType {
    return this.type;
  }

  get Position(): Position | null {
    return this.position;
  }

  set Position(position: Position | null) {
    // Primarily intended for tests to nullify position
    // so test cases can focus on structural comparison
    this.position = position;
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

  constructor(
    init_stmts: StatementTreeNode[] = [],
    position: Position | null = null,
  ) {
    super(NodeType.Recipe, position);
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
    position: Position | null = null,
  ) {
    super(NodeType.Call, position);
    this.name = name;
    this.argList = argList;
    this.styling = styling;
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = [...this.argList];
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
  private rhs: CallTreeNode | NamespaceTreeNode | ImportTreeNode | null;

  constructor(
    varList: LocalVarTreeNode[],
    rhs: CallTreeNode | NamespaceTreeNode | ImportTreeNode | null,
    position: Position | null = null,
  ) {
    super(NodeType.Assignment, position);
    this.lhs = varList;
    this.rhs = rhs;
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = [...this.lhs];
    if (this.rhs) childList.push(this.rhs);
    return childList;
  }

  debugDump(): string {
    return "Assignment:";
  }

  get Lhs(): LocalVarTreeNode[] {
    return this.lhs;
  }

  get Rhs(): CallTreeNode | NamespaceTreeNode | ImportTreeNode | null {
    return this.rhs;
  }
}

export class AliasTreeNode extends BaseTreeNode {
  private lhs: LocalVarTreeNode | null;
  private rhs: QualifiedVarTreeNode | null;

  constructor(
    lhs: LocalVarTreeNode | null,
    rhs: QualifiedVarTreeNode | null,
    position: Position | null = null,
  ) {
    super(NodeType.Alias, position);
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

export class StyleTagTreeNode extends BaseTreeNode {
  private qualifiableTagName: QualifiableIdentifier;

  constructor(value: QualifiableIdentifier, position: Position | null = null) {
    super(NodeType.StyleTag, position);
    this.qualifiableTagName = value;
  }

  getChildren(): BaseTreeNode[] {
    return [];
  }

  debugDump(): string {
    return "StyleTag: " + this.qualifiableTagName.join(".");
  }

  get QualifiedTagName(): QualifiableIdentifier {
    return this.qualifiableTagName;
  }
}

export class LocalVarTreeNode extends BaseTreeNode {
  private varName: string;
  private styling: StyleTreeNode | null;

  constructor(
    value: string,
    styling: StyleTreeNode | null = null,
    position: Position | null = null,
  ) {
    super(NodeType.LocalVariable, position);
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

  constructor(value: QualifiableIdentifier, position: Position | null = null) {
    super(NodeType.QualifiedVariable, position);
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
  private styleTagList: StyleTagTreeNode[];

  constructor(
    initMap: Map<string, string> = new Map(),
    initTags: StyleTagTreeNode[] = [],
    position: Position | null = null,
  ) {
    super(NodeType.Style, position);
    this.keyValueMap = initMap;
    this.styleTagList = initTags;
  }

  addKeyValue(key: string, value: string): void {
    this.keyValueMap.set(key, value);
  }

  addStyleTag(styleTag: StyleTagTreeNode): void {
    this.styleTagList.push(styleTag);
  }

  getChildren(): BaseTreeNode[] {
    return this.styleTagList;
  }

  debugDump(): string {
    const styleTagListStr = this.styleTagList
      .map((tag) => tag.QualifiedTagName.join("."))
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

  get StyleTagList(): StyleTagTreeNode[] {
    return this.styleTagList;
  }
}

export class NamedStyleTreeNode extends BaseTreeNode {
  private styleName: string;
  private styleNode: StyleTreeNode;

  constructor(
    styleName: string = "",
    styleNode: StyleTreeNode = new StyleTreeNode(new Map(), [], null),
    position: Position | null = null,
  ) {
    super(NodeType.NamedStyle, position);
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
  private styleTagList: StyleTagTreeNode[];

  constructor(
    keyword: string = "",
    styleTagList: StyleTagTreeNode[] = [],
    position: Position | null = null,
  ) {
    super(NodeType.StyleBinding, position);
    this.keyword = keyword;
    this.styleTagList = styleTagList;
  }

  getChildren(): BaseTreeNode[] {
    return this.styleTagList;
  }

  debugDump(): string {
    const styleTagListStr = this.styleTagList
      .map((tag) => tag.QualifiedTagName.join("."))
      .join(", ");
    return (
      `StyleBinding: ${this.keyword} ` + `StyleTagList: [${styleTagListStr}]`
    );
  }

  get Keyword(): string {
    return this.keyword;
  }

  get StyleTagList(): StyleTagTreeNode[] {
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
    position: Position | null = null,
  ) {
    super(NodeType.Namespace, position);
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
  private importName: string | null;

  constructor(
    importPath: string,
    importName: string | null = null,
    position: Position | null = null,
  ) {
    super(NodeType.Import, position);
    this.importLocation = importPath;
    this.importName = importName === "" ? null : importName;
  }

  getChildren(): BaseTreeNode[] {
    return [];
  }

  debugDump(): string {
    const aliasString = this.importName ? this.importName + " " : "";
    return "Import: " + aliasString + this.importLocation;
  }

  get ImportLocation(): string {
    return this.importLocation;
  }

  get ImportName(): string | null {
    return this.importName;
  }
}
