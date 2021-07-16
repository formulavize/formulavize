import { v4 as uuidv4 } from 'uuid';

import { RecipeTreeNode, CallTreeNode, AssignmentTreeNode,
         AliasTreeNode, VariableTreeNode, NodeType} from "./ast"
import { Dag } from "./dag" 

function processCall(callStmt: CallTreeNode,
                     varNameToNodeIdMap: Map<string, string>,
                     workingDag: Dag) : string {
  const nodeId = uuidv4()
  type NodeIdVarNamePair = [string, string]
  let argIdentList: Array<NodeIdVarNamePair> = [] // node id, variable name
  for (let arg of callStmt.ArgList) {
    switch(arg.Type) {
      case NodeType.Call:
        const argNodeId = processCall(arg as CallTreeNode, varNameToNodeIdMap, workingDag)
        argIdentList.push([argNodeId, ""])
        break
      case NodeType.Variable:
        const argVarName = arg as VariableTreeNode
        const varName = argVarName.Value
        const candidateSrcNodeId = varNameToNodeIdMap.get(varName)
        if (candidateSrcNodeId) {
          argIdentList.push([candidateSrcNodeId, varName])
        } else {
          console.log('Unable to find variable with name ', varName)
        }
        break
      default:
        console.log("Unknown node type ", arg.Type)
    }
  }
  const thisNode = { id: nodeId, name: callStmt.Name }
  workingDag.addNode(thisNode) 

  for (let argIdent of argIdentList) {
    const edgeId = uuidv4()
    const thisEdge = { 
      id: edgeId,
      name: argIdent[1],
      srcNodeId: argIdent[0],
      destNodeId: nodeId
    }
    workingDag.addEdge(thisEdge)
  }

  return nodeId
}

export function makeDag(recipe: RecipeTreeNode): Dag {
  let varNameToNodeIdMap = new Map()
  let resultDag = new Dag()
  for (let stmt of recipe.getChildren()) {
    switch(stmt.Type) {
      case NodeType.Call:
        const callStmt = stmt as CallTreeNode
        processCall(callStmt, varNameToNodeIdMap, resultDag)
        break
      case NodeType.Assignment:
        const assigmentStmt = stmt as AssignmentTreeNode
        if (assigmentStmt.Rhs) {
          const thisNodeId = processCall(assigmentStmt.Rhs, varNameToNodeIdMap, resultDag)
          const lhsVals = assigmentStmt.Lhs.map(v => v.Value)
          for (let lhsVar of lhsVals) {
            varNameToNodeIdMap.set(lhsVar, thisNodeId)
          }
        } else {
          console.log('The assignment statement has no RHS ', stmt)
        }
        break
      case NodeType.Alias:
        const aliasStmt = stmt as AliasTreeNode
        const aliasRhsVal = aliasStmt.Rhs?.Value
        const aliasLhsVal = aliasStmt.Lhs?.Value
        if (varNameToNodeIdMap.has(aliasRhsVal) && aliasLhsVal) {
          // Assumes recipes are processed incrementally
          // and intermediate aliases are not modified
          const RhsCurTarget = varNameToNodeIdMap.get(aliasRhsVal)
          varNameToNodeIdMap.set(aliasLhsVal, RhsCurTarget)
        } else {
          console.log('var ' + aliasRhsVal + ' not found')
        }
        break
    }
  }
  return resultDag
}