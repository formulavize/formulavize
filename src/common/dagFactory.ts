import { match } from 'ts-pattern'
import { v4 as uuidv4 } from 'uuid'

import { RecipeTreeNode, CallTreeNode, AssignmentTreeNode,
         AliasTreeNode, VariableTreeNode, NodeType,
         StyleTreeNode, NamedStyleTreeNode, StyleBindingTreeNode } from "./ast"
import { Dag, NodeId, StyleTag, StyleProperties} from "./dag"

function processCall(callStmt: CallTreeNode,
                     varNameToNodeId: Map<string, NodeId>,
                     varNameToStyleNode: Map<string, StyleTreeNode>,
                     workingDag: Dag) : NodeId {
  type IncomingEdgeInfo = {
    nodeId: NodeId,
    varName: string,
    varStyle: StyleTreeNode | null
  }
  const incomingEdgeInfoList: IncomingEdgeInfo[] = callStmt.ArgList.map(
    arg => match(arg.Type)
      .with(NodeType.Call, () => {
        const argNodeId = processCall(arg as CallTreeNode, varNameToNodeId, varNameToStyleNode, workingDag)
        return { nodeId: argNodeId, varName: "", varStyle: null }
      })
      .with(NodeType.Variable, () => {
        const argVarName = arg as VariableTreeNode
        const varName = argVarName.Value
        const varStyle = varNameToStyleNode.get(varName) ?? null
        const candidateSrcNodeId = varNameToNodeId.get(varName)
        if (candidateSrcNodeId) {
          return { nodeId: candidateSrcNodeId, varName: varName, varStyle: varStyle }
        } else {
          console.log('Unable to find variable with name ', varName)
          return null
        }
      })
      .otherwise(() => {
        console.log("Unknown node type ", arg.Type)
        return null
      })
  ).filter(incomingEdge => !!incomingEdge) as IncomingEdgeInfo[]

  const thisNodeId = uuidv4()
  const thisNode = {
    id: thisNodeId,
    name: callStmt.Name,
    styleTags: callStmt.Styling?.StyleTagList ?? [],
    styleProperties: callStmt.Styling?.KeyValueMap ?? new Map<string, string>(),
  }
  workingDag.addNode(thisNode) 

  incomingEdgeInfoList.forEach(incomingEdge => {
    const edgeId = uuidv4()
    const thisEdge = {
      id: edgeId,
      name: incomingEdge.varName,
      srcNodeId: incomingEdge.nodeId,
      destNodeId: thisNodeId,
      styleTags: incomingEdge.varStyle?.StyleTagList ?? [],
      styleProperties: incomingEdge.varStyle?.KeyValueMap ?? new Map<string, string>(),
    }
    workingDag.addEdge(thisEdge)
  })

  return thisNodeId
}

export function makeDag(recipe: RecipeTreeNode): Dag {
  const varNameToNodeId = new Map<string, NodeId>()
  const varNameToStyleNode = new Map<string, StyleTreeNode>()
  const styleTagToFlatStyleMap = new Map<StyleTag, StyleProperties>()
  const resultDag = new Dag()

  function mergeMap<K, V>(mutableMap: Map<K, V>, mapToAdd: Map<K, V>): void {
    mapToAdd.forEach((value, key) => {
      mutableMap.set(key, value)
    })
  }

  recipe.getChildren().forEach(stmt => {
    match(stmt.Type)
      .with(NodeType.Call, () => {
        const callStmt = stmt as CallTreeNode
        processCall(callStmt, varNameToNodeId, varNameToStyleNode, resultDag)
      })
      .with(NodeType.Assignment, () => {
        const assignmentStmt = stmt as AssignmentTreeNode
        if (assignmentStmt.Lhs && assignmentStmt.Rhs) {
          const thisNodeId = processCall(assignmentStmt.Rhs, varNameToNodeId, varNameToStyleNode, resultDag)
          assignmentStmt.Lhs.forEach(lhsVar => {
            varNameToNodeId.set(lhsVar.Value, thisNodeId)
            if (lhsVar.Styling) varNameToStyleNode.set(lhsVar.Value, lhsVar.Styling)
          })
        }
      })
      .with(NodeType.Alias, () => {
        const aliasStmt = stmt as AliasTreeNode
        if (aliasStmt.Lhs && aliasStmt.Rhs) {
          const lhsName = aliasStmt.Lhs!.Value
          const rhsName = aliasStmt.Rhs!.Value
          const RhsReferentNodeId = varNameToNodeId.get(rhsName)
          if (RhsReferentNodeId) {
            varNameToNodeId.set(lhsName, RhsReferentNodeId)
          } else {
            console.log(`var ${lhsName} not found`);
          }
          if (aliasStmt.Lhs.Styling) varNameToStyleNode.set(lhsName, aliasStmt.Lhs.Styling)
        }
      })
      .with(NodeType.NamedStyle, () => {
        const namedStyleStmt = stmt as NamedStyleTreeNode
        const styleNode = namedStyleStmt.StyleNode
        const workingStyleProperties: StyleProperties = new Map()
        styleNode.StyleTagList.forEach(styleTag => {
          const referentStyle = styleTagToFlatStyleMap.get(styleTag)
          if (referentStyle) {
            mergeMap(workingStyleProperties, referentStyle)
          } else { // styles must be declared before usage
            console.log(`styleTag ${styleTag} not found`);
          }
        })
        // any locally defined properties will overwrite referenced styles
        mergeMap(workingStyleProperties, styleNode.KeyValueMap)
        const thisStyleTag = namedStyleStmt.StyleName
        styleTagToFlatStyleMap.set(thisStyleTag, workingStyleProperties)
        resultDag.addStyle(thisStyleTag, workingStyleProperties)
      })
      .with(NodeType.StyleBinding, () => {
        const styleBindingStmt = stmt as StyleBindingTreeNode
        resultDag.addStyleBinding(styleBindingStmt.Keyword, styleBindingStmt.StyleTagList)
      })
      .otherwise(() => {
        console.log("Unknown node type ", stmt.Type)
      })
  })
  return resultDag
}
