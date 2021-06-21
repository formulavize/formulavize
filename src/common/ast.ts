export enum NodeType {
  Call,
  Assignment,
  Alias,
  Variable,
  Recipe,
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

export type StatementTreeNode = CallTreeNode | AssignmentTreeNode | AliasTreeNode

export class RecipeTreeNode extends BaseTreeNode {
  private statements: Array<StatementTreeNode>

  constructor() {
    super(NodeType.Recipe)
    this.statements = []
  }

  addChild(child: StatementTreeNode): void {
    this.statements.push(child)
  }

  getChildren(): Array<BaseTreeNode> {
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

  constructor(name: string, argList: Array<ValueTreeNode>) {
    super(NodeType.Call)
    this.name = name
    this.argList = argList
  }

  getChildren(): Array<BaseTreeNode> {
    return this.argList
  }

  formatValue(): string {
    return "Call: " + this.name
  }

  isComplete(): boolean {
    return this.name !== ""
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
    let retList: Array<ValueTreeNode> = this.lhs
    if (this.rhs) retList.push(this.rhs)
    return retList
  }

  formatValue(): string {
    return "Assignment:"
  }

  isComplete(): boolean {
    return this.lhs.length > 0 && this.rhs !== null
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
    let retList = []
    if (this.lhs) retList.push(this.lhs)
    if (this.rhs) retList.push(this.rhs)
    return retList
  }

  formatValue(): string {
    return "Alias:"
  }

  isComplete(): boolean {
    return this.lhs !== null && this.rhs !== null
  }
}

export class VariableTreeNode extends BaseTreeNode {
  private value: string

  constructor(value: string) {
    super(NodeType.Variable)
    this.value = value
  }

  getChildren(): Array<BaseTreeNode> {
    return []
  }

  formatValue(): string {
    return "Variable: " + this.value
  }

  isComplete(): boolean {
    return this.value !== ""
  }
}