import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";

import {
  RecipeTreeNode,
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

class NamespaceContext {
  private varNameToNodeId: Map<string, NodeId>;
  private varNameToStyleNode: Map<string, StyleTreeNode>;
  private styleTagToFlatStyleMap: Map<StyleTag, StyleProperties>;

  constructor() {
    this.varNameToNodeId = new Map<string, NodeId>();
    this.varNameToStyleNode = new Map<string, StyleTreeNode>();
    this.styleTagToFlatStyleMap = new Map<StyleTag, StyleProperties>();
  }

  setVarNode(varName: string, nodeId: NodeId): void {
    this.varNameToNodeId.set(varName, nodeId);
  }

  setVarStyle(varName: string, styleNode: StyleTreeNode): void {
    this.varNameToStyleNode.set(varName, styleNode);
  }

  setStyle(styleTag: StyleTag, styleProperties: StyleProperties): void {
    this.styleTagToFlatStyleMap.set(styleTag, styleProperties);
  }

  getVarNode(varName: string): NodeId | undefined {
    return this.varNameToNodeId.get(varName);
  }

  getVarStyle(varName: string): StyleTreeNode | undefined {
    return this.varNameToStyleNode.get(varName);
  }

  getStyle(styleTag: StyleTag): StyleProperties | undefined {
    return this.styleTagToFlatStyleMap.get(styleTag);
  }
}

function processCall(
  callStmt: CallTreeNode,
  context: NamespaceContext,
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
        const argNodeId = processCall(arg as CallTreeNode, context, workingDag);
        return { nodeId: argNodeId, varName: "", varStyle: null };
      })
      .with(NodeType.Variable, () => {
        const argVarName = arg as VariableTreeNode;
        const varName = argVarName.Value;
        const varStyle = context.getVarStyle(varName) ?? null;
        const candidateSrcNodeId = context.getVarNode(varName);
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
  dagNamespaceStmt: NamespaceTreeNode,
  parentDag?: Dag,
): Dag {
  const namespaceContext = new NamespaceContext();
  const curLevelDag = new Dag(dagId, parentDag, dagNamespaceStmt.Name);

  function mergeMap<K, V>(mutableMap: Map<K, V>, mapToAdd: Map<K, V>): void {
    mapToAdd.forEach((value, key) => {
      mutableMap.set(key, value);
    });
  }

  dagNamespaceStmt.Statements.forEach((stmt) => {
    match(stmt.Type)
      .with(NodeType.Call, () => {
        const callStmt = stmt as CallTreeNode;
        processCall(callStmt, namespaceContext, curLevelDag);
      })
      .with(NodeType.Assignment, () => {
        const assignmentStmt = stmt as AssignmentTreeNode;
        if (assignmentStmt.Lhs && assignmentStmt.Rhs) {
          const thisNodeId = processCall(
            assignmentStmt.Rhs,
            namespaceContext,
            curLevelDag,
          );
          assignmentStmt.Lhs.forEach((lhsVar) => {
            namespaceContext.setVarNode(lhsVar.Value, thisNodeId);
            if (lhsVar.Styling)
              namespaceContext.setVarStyle(lhsVar.Value, lhsVar.Styling);
          });
        }
      })
      .with(NodeType.Alias, () => {
        const aliasStmt = stmt as AliasTreeNode;
        if (aliasStmt.Lhs && aliasStmt.Rhs) {
          const lhsName = aliasStmt.Lhs!.Value;
          const rhsName = aliasStmt.Rhs!.Value;
          const RhsReferentNodeId = namespaceContext.getVarNode(rhsName);
          if (RhsReferentNodeId) {
            namespaceContext.setVarNode(lhsName, RhsReferentNodeId);
          } else {
            console.log(`var ${lhsName} not found`);
          }
          if (aliasStmt.Lhs.Styling)
            namespaceContext.setVarStyle(lhsName, aliasStmt.Lhs.Styling);
        }
      })
      .with(NodeType.NamedStyle, () => {
        const namedStyleStmt = stmt as NamedStyleTreeNode;
        const styleNode = namedStyleStmt.StyleNode;
        const workingStyleProperties: StyleProperties = new Map();
        styleNode.StyleTagList.forEach((styleTag) => {
          const referentStyle = namespaceContext.getStyle(styleTag);
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
        namespaceContext.setStyle(thisStyleTag, workingStyleProperties);
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
          namespaceStmt,
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
  return makeSubDag(
    TOP_LEVEL_DAG_ID,
    new NamespaceTreeNode("", recipe.Statements),
  );
}
