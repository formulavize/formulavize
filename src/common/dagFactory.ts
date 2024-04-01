import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";

import {
  RecipeTreeNode,
  StatementTreeNode,
  CallTreeNode,
  AssignmentTreeNode,
  AliasTreeNode,
  VariableTreeNode,
  NodeType,
  StyleTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
  NamespaceTreeNode,
} from "./ast";
import { Dag, NodeId, StyleTag, StyleProperties, DagId } from "./dag";
import { TOP_LEVEL_DAG_ID } from "./constants";

function processCall(
  callStmt: CallTreeNode,
  varNameToNodeId: Map<string, NodeId>,
  varNameToStyleNode: Map<string, StyleTreeNode>,
  workingDag: Dag,
): NodeId {
  type IncomingEdgeInfo = {
    nodeId: NodeId;
    varName: string;
    varStyle: StyleTreeNode | null;
  };
  const incomingEdgeInfoList: IncomingEdgeInfo[] = callStmt.ArgList.map((arg) =>
    match(arg.Type)
      .with(NodeType.Call, () => {
        const argNodeId = processCall(
          arg as CallTreeNode,
          varNameToNodeId,
          varNameToStyleNode,
          workingDag,
        );
        return { nodeId: argNodeId, varName: "", varStyle: null };
      })
      .with(NodeType.Variable, () => {
        const argVarName = arg as VariableTreeNode;
        const varName = argVarName.Value;
        const varStyle = varNameToStyleNode.get(varName) ?? null;
        const candidateSrcNodeId = varNameToNodeId.get(varName);
        if (candidateSrcNodeId) {
          return {
            nodeId: candidateSrcNodeId,
            varName: varName,
            varStyle: varStyle,
          };
        } else {
          console.log("Unable to find variable with name ", varName);
          return null;
        }
      })
      .otherwise(() => {
        console.log("Unknown node type ", arg.Type);
        return null;
      }),
  ).filter(Boolean) as IncomingEdgeInfo[];

  const thisNodeId = uuidv4();
  const thisNode = {
    id: thisNodeId,
    name: callStmt.Name,
    styleTags: callStmt.Styling?.StyleTagList ?? [],
    styleProperties: callStmt.Styling?.KeyValueMap ?? new Map<string, string>(),
  };
  workingDag.addNode(thisNode);

  incomingEdgeInfoList.forEach((incomingEdge) => {
    const edgeId = uuidv4();
    const thisEdge = {
      id: edgeId,
      name: incomingEdge.varName,
      srcNodeId: incomingEdge.nodeId,
      destNodeId: thisNodeId,
      styleTags: incomingEdge.varStyle?.StyleTagList ?? [],
      styleProperties:
        incomingEdge.varStyle?.KeyValueMap ?? new Map<string, string>(),
    };
    workingDag.addEdge(thisEdge);
  });

  return thisNodeId;
}

export function makeSubDag(
  dagId: DagId,
  dagName: string,
  statements: StatementTreeNode[],
  parentDag?: Dag,
): Dag {
  const varNameToNodeId = new Map<string, NodeId>();
  const varNameToStyleNode = new Map<string, StyleTreeNode>();
  const styleTagToFlatStyleMap = new Map<StyleTag, StyleProperties>();
  const curLevelDag = new Dag(dagId, parentDag, dagName);

  function mergeMap<K, V>(mutableMap: Map<K, V>, mapToAdd: Map<K, V>): void {
    mapToAdd.forEach((value, key) => {
      mutableMap.set(key, value);
    });
  }

  statements.forEach((stmt) => {
    match(stmt.Type)
      .with(NodeType.Call, () => {
        const callStmt = stmt as CallTreeNode;
        processCall(callStmt, varNameToNodeId, varNameToStyleNode, curLevelDag);
      })
      .with(NodeType.Assignment, () => {
        const assignmentStmt = stmt as AssignmentTreeNode;
        if (assignmentStmt.Lhs && assignmentStmt.Rhs) {
          const thisNodeId = processCall(
            assignmentStmt.Rhs,
            varNameToNodeId,
            varNameToStyleNode,
            curLevelDag,
          );
          assignmentStmt.Lhs.forEach((lhsVar) => {
            varNameToNodeId.set(lhsVar.Value, thisNodeId);
            if (lhsVar.Styling)
              varNameToStyleNode.set(lhsVar.Value, lhsVar.Styling);
          });
        }
      })
      .with(NodeType.Alias, () => {
        const aliasStmt = stmt as AliasTreeNode;
        if (aliasStmt.Lhs && aliasStmt.Rhs) {
          const lhsName = aliasStmt.Lhs!.Value;
          const rhsName = aliasStmt.Rhs!.Value;
          const RhsReferentNodeId = varNameToNodeId.get(rhsName);
          if (RhsReferentNodeId) {
            varNameToNodeId.set(lhsName, RhsReferentNodeId);
          } else {
            console.log(`var ${lhsName} not found`);
          }
          if (aliasStmt.Lhs.Styling)
            varNameToStyleNode.set(lhsName, aliasStmt.Lhs.Styling);
        }
      })
      .with(NodeType.NamedStyle, () => {
        const namedStyleStmt = stmt as NamedStyleTreeNode;
        const styleNode = namedStyleStmt.StyleNode;
        const workingStyleProperties: StyleProperties = new Map();
        styleNode.StyleTagList.forEach((styleTag) => {
          const referentStyle = styleTagToFlatStyleMap.get(styleTag);
          if (referentStyle) {
            mergeMap(workingStyleProperties, referentStyle);
          } else {
            // styles must be declared before usage
            console.log(`styleTag ${styleTag} not found`);
          }
        });
        // any locally defined properties will overwrite referenced styles
        mergeMap(workingStyleProperties, styleNode.KeyValueMap);
        const thisStyleTag = namedStyleStmt.StyleName;
        styleTagToFlatStyleMap.set(thisStyleTag, workingStyleProperties);
        curLevelDag.addStyle(thisStyleTag, workingStyleProperties);
      })
      .with(NodeType.StyleBinding, () => {
        const styleBindingStmt = stmt as StyleBindingTreeNode;
        curLevelDag.addStyleBinding(
          styleBindingStmt.Keyword,
          styleBindingStmt.StyleTagList,
        );
      })
      .with(NodeType.Variable, () => null)
      .with(NodeType.Namespace, () => {
        const namespaceStmt = stmt as NamespaceTreeNode;
        const thisNamespaceId = uuidv4();
        const childDag = makeSubDag(
          thisNamespaceId,
          namespaceStmt.Name,
          namespaceStmt.Statements,
          curLevelDag,
        );
        curLevelDag.addChildDag(childDag);
      })
      .otherwise(() => {
        console.log("Unknown node type ", stmt.Type);
      });
  });
  return curLevelDag;
}

export function makeDag(recipe: RecipeTreeNode): Dag {
  return makeSubDag(TOP_LEVEL_DAG_ID, "", recipe.Statements);
}
