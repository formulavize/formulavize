export enum NodeType {
  Call,
  Assignment,
  Alias,
  Variable,
  Recipe,
  Style,
  NamedStyle,
  StyleBinding
}

export abstract class BaseTreeNode {
  protected type: NodeType

  constructor(type: NodeType) {
    this.type = type
  }

  get Type(): NodeType {
    return this.type
  }

  abstract getChildren(): BaseTreeNode[]

  abstract formatValue(): string

  abstract isComplete(): boolean

  formatTree(): string {
    const formatTreeHelper = (node: BaseTreeNode, lvl: number): string => {
      return node.formatValue() + "\n"
        + node.getChildren()
              .map(child => "\t".repeat(lvl+1) + formatTreeHelper(child, lvl+1))
              .join("")
    }
    return formatTreeHelper(this, 0)
  }
}

export type StatementTreeNode = CallTreeNode 
  | AssignmentTreeNode 
  | AliasTreeNode 
  | NamedStyleTreeNode
  | StyleBindingTreeNode

export class RecipeTreeNode extends BaseTreeNode {
  private statements: StatementTreeNode[]

  constructor(init_stmts: StatementTreeNode[] = []) {
    super(NodeType.Recipe)
    this.statements = init_stmts
  }

  addChild(child: StatementTreeNode): void {
    this.statements.push(child)
  }

  getChildren(): StatementTreeNode[] {
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
  private argList: ValueTreeNode[]
  private styling: StyleTreeNode | null

  constructor(
    name: string,
    argList: ValueTreeNode[],
    styling: StyleTreeNode | null = null
  ) {
    super(NodeType.Call)
    this.name = name
    this.argList = argList
    this.styling = styling
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = this.argList
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
  
  get ArgList(): ValueTreeNode[] {
    return this.argList
  }

  get Styling(): StyleTreeNode | null {
    return this.styling
  }
}

export class AssignmentTreeNode extends BaseTreeNode {
  private lhs: VariableTreeNode[]
  private rhs: CallTreeNode | null

  constructor(varList: VariableTreeNode[], call: CallTreeNode | null) {
    super(NodeType.Assignment)
    this.lhs = varList
    this.rhs = call
  }

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = this.lhs
    if (this.rhs) childList.push(this.rhs)
    return childList
  }

  formatValue(): string {
    return "Assignment:"
  }

  isComplete(): boolean {
    return this.lhs.length > 0 && this.rhs !== null
  }

  get Lhs(): VariableTreeNode[] {
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

  getChildren(): BaseTreeNode[] {
    const childList: BaseTreeNode[] = []
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

  getChildren(): BaseTreeNode[] {
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
  private styleTagList: string[]

  constructor(
    initMap: Map<string, string> = new Map(),
    initTags: string[] = []
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

  getChildren(): BaseTreeNode[] {
    return []
  }

  formatValue(): string {
    return "StyleTagList: ["
      + this.styleTagList.toString()
      + "] StyleKeyValueMap: "
      + JSON.stringify(Object.fromEntries(this.keyValueMap))
  }

  isComplete(): boolean {
    return true
  }

  get KeyValueMap(): Map<string, string> {
    return this.keyValueMap
  }

  get StyleTagList(): string[] {
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

  getChildren(): BaseTreeNode[] {
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

export class StyleBindingTreeNode extends BaseTreeNode {
  private keyword: string
  private styleTagList: string[]

  constructor(
    keyword: string = "",
    styleTagList: string[] = []
  ) {
    super(NodeType.StyleBinding)
    this.keyword = keyword
    this.styleTagList = styleTagList
  }

  getChildren(): BaseTreeNode[] {
    return []
  }

  formatValue(): string {
    return "StyleBinding: " + this.keyword
      + " StyleTagList: [" + this.styleTagList.toString() + "]"
  }

  isComplete(): boolean {
    return true
  }

  get Keyword(): string {
    return this.keyword
  }

  get StyleTagList(): string[] {
    return this.styleTagList
  }
}
