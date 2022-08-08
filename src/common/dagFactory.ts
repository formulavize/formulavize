import { v4 as uuidv4 } from 'uuid';

import { RecipeTreeNode, CallTreeNode, AssignmentTreeNode,
         AliasTreeNode, VariableTreeNode, NodeType,
         StyleTreeNode, NamedStyleTreeNode } from "./ast"
import { Dag } from "./dag" 

function processCall(callStmt: CallTreeNode,
                     varNameToNodeIdMap: Map<string, string>,
                     varNameToStyleNode: Map<string, StyleTreeNode>,
                     workingDag: Dag) : string {
  type IncomingEdgeInfo = {
    nodeId: string,
    varName: string,
    varStyle: StyleTreeNode | null
  }
  const incomingEdgeInfoList: Array<IncomingEdgeInfo> = []
  for (const arg of callStmt.ArgList) {
    switch(arg.Type) {
      case NodeType.Call: {
        const argNodeId = processCall(
          arg as CallTreeNode,
          varNameToNodeIdMap,
          varNameToStyleNode,
          workingDag
        )
        incomingEdgeInfoList.push({
          nodeId: argNodeId, 
          varName: "", // unnamed
          varStyle: null // unstyled
        })
        break
      }
      case NodeType.Variable: {
        const argVarName = arg as VariableTreeNode
        const varName = argVarName.Value
        const candidateSrcNodeId = varNameToNodeIdMap.get(varName)
        if (candidateSrcNodeId) {
          incomingEdgeInfoList.push({
            nodeId: candidateSrcNodeId,
            varName: varName,
            varStyle: varNameToStyleNode.get(varName) ?? null
          })
        } else {
          console.log('Unable to find variable with name ', varName)
        }
        break
      }
      default: {
        console.log("Unknown node type ", arg.Type)
      }
    }
  }
  const thisNodeId = uuidv4()
  const thisNode = {
    id: thisNodeId,
    name: callStmt.Name,
    styleTags: callStmt.Styling?.StyleTagList ?? [],
    styleMap: callStmt.Styling?.KeyValueMap ?? new Map<string, string>(),
  }
  workingDag.addNode(thisNode) 

  for (const incomingEdge of incomingEdgeInfoList) {
    const edgeId = uuidv4()
    const thisEdge = { 
      id: edgeId,
      name: incomingEdge.varName,
      srcNodeId: incomingEdge.nodeId,
      destNodeId: thisNodeId,
      styleTags: incomingEdge.varStyle?.StyleTagList ?? [],
      styleMap: incomingEdge.varStyle?.KeyValueMap ?? new Map<string, string>(),
    }
    workingDag.addEdge(thisEdge)
  }

  return thisNodeId
}

export function makeDag(recipe: RecipeTreeNode): Dag {
  const varNameToNodeIdMap = new Map<string, string>()
  const varNameToStyleNode = new Map<string, StyleTreeNode>()
  const styleTagToFlatStyleMap = new Map<string, Map<string, string>>()
  const resultDag = new Dag()

  function mergeMap(
    mutableMap: Map<string, string>, mapToAdd: Map<string, string>
  ): void {
    mapToAdd.forEach((value, key) => {
      mutableMap.set(key, value)
    })
  }

  for (const stmt of recipe.getChildren()) {
    switch(stmt.Type) {
      case NodeType.Call: {
        const callStmt = stmt as CallTreeNode
        processCall(callStmt, varNameToNodeIdMap, varNameToStyleNode, resultDag)
        break
      }
      case NodeType.Assignment: {
        const assigmentStmt = stmt as AssignmentTreeNode
        if (assigmentStmt.Lhs && assigmentStmt.Rhs) {
          const thisNodeId = processCall(
            assigmentStmt.Rhs,
            varNameToNodeIdMap,
            varNameToStyleNode,
            resultDag
          )
          for (const lhsVar of assigmentStmt.Lhs) {
            varNameToNodeIdMap.set(lhsVar.Value, thisNodeId)
            if (lhsVar.Styling) {
              varNameToStyleNode.set(lhsVar.Value, lhsVar.Styling)
            }
          }
        }
        break
      }
      case NodeType.Alias: {
        const aliasStmt = stmt as AliasTreeNode
        if (aliasStmt.Lhs && aliasStmt.Rhs) {
          const lhsName = aliasStmt.Lhs!.Value
          const rhsName = aliasStmt.Rhs!.Value
          const RhsReferentNodeId = varNameToNodeIdMap.get(rhsName)
          if (RhsReferentNodeId) {
            varNameToNodeIdMap.set(lhsName, RhsReferentNodeId)
          } else {
            console.log('var ' + lhsName + ' not found')
          }
          if (aliasStmt.Lhs.Styling) {
            varNameToStyleNode.set(lhsName, aliasStmt.Lhs.Styling)
          }
        }
        break
      }
      case NodeType.NamedStyle: {
        const namedStyleStmt = stmt as NamedStyleTreeNode
        const styleNode = namedStyleStmt.StyleNode
        const workingStyleMap = new Map<string, string>()
        for (const styleTag of styleNode.StyleTagList) {
          const referentStyle = styleTagToFlatStyleMap.get(styleTag)
          if (referentStyle) {
            mergeMap(workingStyleMap, referentStyle)
          } else { // styles must be declared before usage
            console.log('styleTag ' + styleTag + ' not found')
          }
        }
        // any locally defined properties will overwrite referenced styles
        mergeMap(workingStyleMap, styleNode.KeyValueMap)
        const thisStyleTag = namedStyleStmt.StyleName
        styleTagToFlatStyleMap.set(thisStyleTag, workingStyleMap)
        resultDag.addStyle(thisStyleTag, workingStyleMap)
        break
      }
    }
  }
  return resultDag
}