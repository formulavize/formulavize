import { EditorState } from "@codemirror/state"
import { syntaxTree } from "@codemirror/language"
import { DESCRIPTION_PROPERTY } from "./constants"
import { TreeCursor } from "@lezer/common"
import { RecipeTreeNode, StatementTreeNode, ValueTreeNode, CallTreeNode,
         AssignmentTreeNode, AliasTreeNode, VariableTreeNode,
         StyleTreeNode, NamedStyleTreeNode, StyleBindingTreeNode
        } from "./ast"

function fillStyleTag(c: TreeCursor, s: EditorState): string {
  let styleTagIdent = ""
  const childTagId = c.node.getChild("Identifier")
  if (childTagId) {
    styleTagIdent = s.doc.sliceString(childTagId.from, childTagId.to)
  }
  return styleTagIdent
}

function fillStyle(c: TreeCursor, s: EditorState): StyleTreeNode {
  const styleTags: string[] = []
  c.node.getChildren("StyleTag").forEach(
    (styleTag) => {
      const styleTagIdent = fillStyleTag(styleTag.cursor(), s)
      styleTags.push(styleTagIdent)
    }
  )

  const descriptions: string[] = []
  c.node.getChildren("StringLiteral").forEach(
    (stringLiteral) => {
      // trims quotes from the start and end
      const desc = s.doc.sliceString(stringLiteral.from+1, stringLiteral.to-1)
      descriptions.push(desc)
    }
  )

  const styleDeclaredPropertyValues = new Map<string, string>()

  // If there are description strings, store them in a description property
  if (descriptions.length > 0) {
    styleDeclaredPropertyValues.set(DESCRIPTION_PROPERTY, descriptions.join('\n'))
  }

  c.node.getChildren("StyleDeclaration").forEach(
    (styleDec) => {
      const candidatePropName = styleDec.getChild("PropertyName")
      let propName = ""
      if (candidatePropName) {
        propName = s.doc.sliceString(candidatePropName.from, candidatePropName.to)
      }

      const candidateStyleVal = styleDec.getChildren("StyleValue")
      const styleVals = candidateStyleVal.map((styleVal) => {
          return s.doc.sliceString(styleVal.from, styleVal.to)
        })
        .join(",") // comma delimit multiple values
        .replace(/(^"|^'|"$|'$)/g, "") // remove captured bounding quotes
        .replace(/\\n/g, "\n") // for enabling cytoscape text-wrap
      styleDeclaredPropertyValues.set(propName, styleVals)
    }
  )

  return new StyleTreeNode(styleDeclaredPropertyValues, styleTags)
}

function fillNamedStyle(c: TreeCursor, s: EditorState): NamedStyleTreeNode {
  let styleName = ""
  const candidateIdent = c.node.getChild("StyleTag")?.getChild("Identifier")
  if (candidateIdent) {
    styleName = s.doc.sliceString(candidateIdent.from, candidateIdent.to)
  }

  let styleNode: StyleTreeNode = new StyleTreeNode()
  const candidateStyleArgList = c.node.getChild("StyleArgList")
  if (candidateStyleArgList) {
    styleNode = fillStyle(candidateStyleArgList.cursor(), s)
  }

  return new NamedStyleTreeNode(styleName, styleNode)
}

function fillStyleBinding(c: TreeCursor, s: EditorState): StyleBindingTreeNode {
  let keyword = ""
  const candidateIdent = c.node.getChild("Identifier")
  if (candidateIdent) {
    keyword = s.doc.sliceString(candidateIdent.from, candidateIdent.to)
  }
  let styleTagList: string[] = []
  const candidateTagList = c.node.getChild("StyleTagList")
  if (candidateTagList) {
    styleTagList = candidateTagList.getChildren("StyleTag").map(
      (styleTag) => fillStyleTag(styleTag.cursor(), s)
    )
  }
  return new StyleBindingTreeNode(keyword, styleTagList)
}

function fillCall(c: TreeCursor, s: EditorState): CallTreeNode {
  let functionName = ""
  const candidateIdent = c.node.getChild("Identifier")
  if (candidateIdent) {
    functionName = s.doc.sliceString(candidateIdent.from, candidateIdent.to)
  }
  const argList: ValueTreeNode[] = []
  const candidateArgList = c.node.getChild("ArgList")
  if (candidateArgList) {
    const valueNodes = candidateArgList.getChildren("Value")
    for (const valNode of valueNodes) {
      switch(valNode.name) {
        case "Call":
          argList.push(fillCall(valNode.cursor(), s))
          break
        case "Variable":
          argList.push(new VariableTreeNode(s.doc.sliceString(valNode.from, valNode.to)))
          break
        default:
          console.log("Unknown node type " + valNode.name)
      }
    }
  }
  let styleNode: StyleTreeNode | null = null
  const candidateStyleArgList = c.node.getChild("StyleArgList")
  if (candidateStyleArgList) {
    styleNode = fillStyle(candidateStyleArgList.cursor(), s)
  }

  return new CallTreeNode(functionName, argList, styleNode)
}

function fillLhsVariable(c: TreeCursor, s: EditorState): VariableTreeNode {
  let ident = ""
  const candidateIdent = c.node.getChild("Variable")
  if (candidateIdent) {
    ident = s.doc.sliceString(candidateIdent.from, candidateIdent.to)
  }

  let styleNode: StyleTreeNode | null = null
  const candidateStyleArgList = c.node.getChild("StyleArgList")
  if (candidateStyleArgList) {
    styleNode = fillStyle(candidateStyleArgList.cursor(), s)
  }

  return new VariableTreeNode(ident, styleNode)
}

function fillAssignment(c: TreeCursor, s: EditorState): AssignmentTreeNode {
  const candidateLhsVars = c.node.getChildren("LhsVariable")
  const lhsVars = candidateLhsVars.map(
    candidateLhsVar => fillLhsVariable(candidateLhsVar.cursor(), s)
  )

  let rhsCall: CallTreeNode | null = null
  const candidateRhsIdent = c.node.getChild("Call")
  if (candidateRhsIdent) {
    rhsCall = fillCall(candidateRhsIdent.cursor(), s)
  }

  return new AssignmentTreeNode(lhsVars, rhsCall)
}

function fillAlias(c: TreeCursor, s: EditorState): AliasTreeNode {
  let lhsVar : VariableTreeNode | null = null
  const candidateLhsVar = c.node.getChild("LhsVariable")
  if (candidateLhsVar) {
    lhsVar = fillLhsVariable(candidateLhsVar.cursor(), s)
  }
  
  let rhsVar : VariableTreeNode | null = null
  const candidateRhsIdent = c.node.getChild("Variable")
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
    case "StyleTagDeclaration":
      stmtNode = fillNamedStyle(c, s)
      break
    case "StyleBinding":
      stmtNode = fillStyleBinding(c, s)
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

/*
Lezer's lightweight design means it doesn't store token values.
https://discuss.codemirror.net/t/example-of-using-lezer-to-generate-a-traditional-ast/2907
We need to fill in the AST values ourselves by looking up syntax tree nodes'
text positions in the document. Though inefficient, reproducing the tree after
every change is the cleanest approach. Memoize / optimize later.
https://discuss.codemirror.net/t/efficient-reuse-of-productions-of-the-parse-tree/2944
*/
export function fillTree(s: EditorState): RecipeTreeNode {
  const editorStateTree = syntaxTree(s)
  const cursor = editorStateTree.cursor()

  if (cursor.name == "") {
    return new RecipeTreeNode()
  }

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