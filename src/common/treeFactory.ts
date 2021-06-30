import { EditorState } from "@codemirror/state"
import { syntaxTree } from "@codemirror/language"
import { TreeCursor } from "lezer-tree"
import { BaseTreeNode, RecipeTreeNode, StatementTreeNode, ValueTreeNode,
         CallTreeNode, AssignmentTreeNode, AliasTreeNode, VariableTreeNode} from "./ast"

function fillCall(c: TreeCursor, s: EditorState): CallTreeNode {
  let functionName = ""
  const candidateIdent = c.node.getChild("Identifier")
  if (candidateIdent) {
    functionName = s.doc.sliceString(candidateIdent.from, candidateIdent.to)
  }
  const argList: Array<ValueTreeNode> = []
  const candidateArgList = c.node.getChild("ArgList")
  if (candidateArgList) {
    const valueNodes = candidateArgList.getChildren("Value")
    for (const valNode of valueNodes) {
      switch(valNode.name) {
        case "Call":
          argList.push(fillCall(valNode.cursor, s))
          break
        case "Variable":
          argList.push(new VariableTreeNode(s.doc.sliceString(valNode.from, valNode.to)))
          break
        default:
          console.log("Unknown node type " + valNode.name)
      }
    }
  }
  return new CallTreeNode(functionName, argList)
}

function fillAssignment(c: TreeCursor, s: EditorState): AssignmentTreeNode {
  const candidateLhsIdent = c.node.getChildren("Variable")
  const lhsVars = candidateLhsIdent.map(
    v => new VariableTreeNode(s.doc.sliceString(v.from, v.to))
  )

  let rhsCall: CallTreeNode | null = null
  const candidateRhsIdent = c.node.getChild("Call")
  if (candidateRhsIdent) {
    rhsCall = fillCall(candidateRhsIdent.cursor, s)
  }
  return new AssignmentTreeNode(lhsVars, rhsCall)
}

function fillAlias(c: TreeCursor, s: EditorState): AliasTreeNode {
  let lhsVar : VariableTreeNode | null = null
  const candidateLhsIdent = c.node.getChild("Variable", null, "Eq")
  if (candidateLhsIdent) {
    const lhsIdent = s.doc.sliceString(candidateLhsIdent.from, candidateLhsIdent.to)
    lhsVar = new VariableTreeNode(lhsIdent)
  }
  
  let rhsVar : VariableTreeNode | null = null
  const candidateRhsIdent = c.node.getChild("Variable", "Eq", null)
  if (candidateRhsIdent) {
    const rhsIdent = s.doc.sliceString(candidateRhsIdent.from, candidateRhsIdent.to)
    rhsVar = new VariableTreeNode(rhsIdent)
  }
  return new AliasTreeNode(lhsVar, rhsVar)
}

function fillStatement(c: TreeCursor, s: EditorState): StatementTreeNode | null {
  let stmtNode: StatementTreeNode | null = null
  switch(c.node.name) {
    case "Call":
      stmtNode = fillCall(c, s)
      break
    case "Alias":
      stmtNode = fillAlias(c, s)
      break
    case "Assignment":
      stmtNode = fillAssignment(c, s)
      break
    case "⚠": // Error token for incomplete trees
      break
    case "Recipe":
      break
    case "LineComment":
      break
    case "BlockComment":
      break
    default:
      console.warn("Unknown node type " + c.node.name)
  }
  return stmtNode
}

export function fillTree(s: EditorState): BaseTreeNode {
  const editorStateTree = syntaxTree(s)
  const cursor = editorStateTree.fullCursor()
  if (cursor.name !== "Recipe") {
    console.error("Failed to parse " + cursor.name)
  }
  const stRoot = new RecipeTreeNode()
  cursor.firstChild()
  do {
    const stmtNode: StatementTreeNode | null = fillStatement(cursor, s)
    if (stmtNode) stRoot.addChild(stmtNode)
  } while(cursor.nextSibling())
  return stRoot
}