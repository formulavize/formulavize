export interface OpDesc {
  name: string
  imgUrl: string
}

export class OpBundle {
  private name: string
  private operators: Map<string, OpDesc>

  constructor(name: string) {
    this.name = name
    this.operators = new Map()
  }

  get Name(): string {
    return this.name
  }

  get Operators(): Map<string, OpDesc> {
    return this.operators
  }

  addOpDesc(opDesc: OpDesc) {
    this.operators.set(opDesc.name, opDesc)
  }

  removeOpDesc(opName: string): boolean {
    return this.operators.delete(opName) // true on success
  }
}