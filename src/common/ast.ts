export enum NodeType {
  Call,
  Assignment,
  Alias,
  Variable,
  Recipe,
  Style,
  NamedStyle,
}

export abstract class BaseTreeNode {
  protected type: NodeType

  constructor(type: NodeType) {
    this.type = type
  }

  get Type(): NodeType {
    return this.type
  }

  abstract getChildren(): Array<BaseTreeNode>

  abstract formatValue(): string

  abstract isComplete(): boolean

  formatTree(): string {
    const formatTreeHelper = (node: BaseTreeNode, lvl: number): string => {
      return node.formatValue() + "\n"
        + node.getChildren()
              .map(child => "\t".repeat(lvl+1) + formatTreeHelper(child, lvl+1))
              .reduce((x, y) => x + y, "")
    }
    return formatTreeHelper(this, 0)
  }
}

export type StatementTreeNode = CallTreeNode 
  | AssignmentTreeNode 
  | AliasTreeNode 
  | NamedStyleTreeNode

export class RecipeTreeNode extends BaseTreeNode {
  private statements: Array<StatementTreeNode>

  constructor(init_stmts: Array<StatementTreeNode> = []) {
    super(NodeType.Recipe)
    this.statements = init_stmts
  }

  addChild(child: StatementTreeNode): void {
    this.statements.push(child)
  }

  getChildren(): Array<StatementTreeNode> {
    return this.statements
  }

  formatValue(): string {
    return "Recipe:"
  }
  
  isComplete(): boolean {
    return true
  }
}

export type ValueTreeNode = CallTreeNode | VariableTreeNode

export class CallTreeNode extends BaseTreeNode {
  private name: string
  private argList: Array<ValueTreeNode>
  private styling: StyleTreeNode | null

  constructor(
    name: string,
    argList: Array<ValueTreeNode>,
    styling: StyleTreeNode | null = null
  ) {
    super(NodeType.Call)
    this.name = name
    this.argList = argList
    this.styling = styling
  }

  getChildren(): Array<BaseTreeNode> {
    const childList: Array<BaseTreeNode> = this.argList
    if (this.styling) childList.push(this.styling)
    return childList
  }

  formatValue(): string {
    return "Call: " + this.name
  }

  isComplete(): boolean {
    return this.name !== ""
  }

  get Name(): string {
    return this.name
  }
  
  get ArgList(): Array<ValueTreeNode> {
    return this.argList
  }

  get Styling(): StyleTreeNode | null {
    return this.styling
  }
}

export class AssignmentTreeNode extends BaseTreeNode {
  private lhs: Array<VariableTreeNode>
  private rhs: CallTreeNode | null

  constructor(varList: Array<VariableTreeNode>, call: CallTreeNode | null) {
    super(NodeType.Assignment)
    this.lhs = varList
    this.rhs = call
  }

  getChildren(): Array<BaseTreeNode> {
    const childList: Array<BaseTreeNode> = this.lhs
    if (this.rhs) childList.push(this.rhs)
    return childList
  }

  formatValue(): string {
    return "Assignment:"
  }

  isComplete(): boolean {
    return this.lhs.length > 0 && this.rhs !== null
  }

  get Lhs(): Array<VariableTreeNode> {
    return this.lhs
  }

  get Rhs(): CallTreeNode | null {
    return this.rhs
  }
}


export class AliasTreeNode extends BaseTreeNode  {
  private lhs: VariableTreeNode | null
  private rhs: VariableTreeNode | null

  constructor(lhs: VariableTreeNode | null, rhs: VariableTreeNode | null) {
    super(NodeType.Alias)
    this.lhs = lhs
    this.rhs = rhs
  }

  getChildren(): Array<BaseTreeNode> {
    const childList: Array<BaseTreeNode> = []
    if (this.lhs) childList.push(this.lhs)
    if (this.rhs) childList.push(this.rhs)
    return childList
  }

  formatValue(): string {
    return "Alias:"
  }

  isComplete(): boolean {
    return this.lhs !== null && this.rhs !== null
  }

  get Lhs(): VariableTreeNode | null {
    return this.lhs
  }

  get Rhs(): VariableTreeNode | null {
    return this.rhs
  }
}

export class VariableTreeNode extends BaseTreeNode {
  private value: string
  private styling: StyleTreeNode | null

  constructor(
    value: string,
    styling: StyleTreeNode | null = null
  ) {
    super(NodeType.Variable)
    this.value = value
    this.styling = styling
  }

  getChildren(): Array<BaseTreeNode> {
    return this.styling ? [this.styling] : []
  }

  formatValue(): string {
    return "Variable: " + this.value
  }

  isComplete(): boolean {
    return this.value !== ""
  }

  get Value(): string {
    return this.value
  }

  get Styling(): StyleTreeNode | null {
    return this.styling
  }
}

export class StyleTreeNode extends BaseTreeNode {
  private keyValueMap: Map<string, string>
  private styleTagList: Array<string>

  constructor(
    initMap: Map<string, string> = new Map(),
    initTags: Array<string> = []
  ) {
    super(NodeType.Style)
    this.keyValueMap = initMap
    this.styleTagList = initTags
  }

  addKeyValue(key: string, value: string): void {
    this.keyValueMap.set(key, value)
  }

  addStyleTag(styleTag: string): void {
    this.styleTagList.push(styleTag)
  }

  getChildren(): Array<BaseTreeNode> {
    return []
  }

  formatValue(): string {
    return "StyleTagList: [" + this.styleTagList.join(' ')
      + "] StyleMap: {"
      + Array.from(this.keyValueMap.entries())
          .map(([k, v]) => k + ":" + v)
          .join(' ')
      + "}"
  }

  isComplete(): boolean {
    return true
  }

  get KeyValueMap(): Map<string, string> {
    return this.keyValueMap
  }

  get StyleTagList(): Array<string> {
    return this.styleTagList
  }
}

export class NamedStyleTreeNode extends BaseTreeNode {
  private styleName: string
  private styleNode: StyleTreeNode

  constructor(
    styleName: string = "",
    styleNode: StyleTreeNode = new StyleTreeNode()
  ) {
    super(NodeType.NamedStyle)
    this.styleName = styleName
    this.styleNode = styleNode
  }

  getChildren(): Array<BaseTreeNode> {
    return [this.styleNode]
  }

  formatValue(): string {
    return "StyleName: " + this.styleName
  }

  isComplete(): boolean {
    return true
  }

  get StyleName(): string {
    return this.styleName
  }

  get StyleNode(): StyleTreeNode {
    return this.styleNode
  }
}
