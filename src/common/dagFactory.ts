import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";

import {
  RecipeTreeNode,
  CallTreeNode,
  AssignmentTreeNode,
  AliasTreeNode,
  QualifiedVarTreeNode,
  NodeType,
  StyleTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
  NamespaceTreeNode,
  QualifiableIdentifier,
} from "./ast";
import {
  Dag,
  NodeId,
  StyleTag,
  StyleProperties,
  DagId,
  DagNode,
  DagEdge,
} from "./dag";
import { TOP_LEVEL_DAG_ID } from "./constants";

class NamespaceContext {
  private curDag: Dag;
  private parentContext?: NamespaceContext;
  private varNameToNodeId: Map<string, NodeId>;
  private varNameToStyleNode: Map<string, StyleTreeNode>;
  private styleTagNameToFlatStyleMap: Map<string, StyleProperties>;
  private nsNameToChildNs: Map<string, NamespaceContext>;

  constructor(curDag: Dag, parentContext?: NamespaceContext) {
    this.curDag = curDag;
    this.parentContext = parentContext;
    this.varNameToNodeId = new Map<string, NodeId>();
    this.varNameToStyleNode = new Map<string, StyleTreeNode>();
    this.styleTagNameToFlatStyleMap = new Map<string, StyleProperties>();
    this.nsNameToChildNs = new Map<string, NamespaceContext>();
  }

  setVarNode(varName: string, nodeId: NodeId): void {
    this.varNameToNodeId.set(varName, nodeId);
  }

  setVarStyle(varName: string, styleNode: StyleTreeNode): void {
    this.varNameToStyleNode.set(varName, styleNode);
  }

  setStyle(styleTagName: string, styleProperties: StyleProperties): void {
    this.styleTagNameToFlatStyleMap.set(styleTagName, styleProperties);
    this.curDag.addStyle(styleTagName, styleProperties);
  }

  getVarNode(varName: QualifiableIdentifier): NodeId | undefined {
    // temporarily get the last part to continue existing behavior
    const tempLastPart = varName.at(-1);
    if (tempLastPart === undefined) return undefined;
    console.log("getVarNode", tempLastPart);
    return this.varNameToNodeId.get(tempLastPart);
  }

  getVarStyle(varName: QualifiableIdentifier): StyleTreeNode | undefined {
    // temporarily get the last part to continue existing behavior
    const tempLastPart = varName.at(-1);
    if (tempLastPart === undefined) return undefined;
    return this.varNameToStyleNode.get(tempLastPart);
  }

  getStyle(styleTag: StyleTag): StyleProperties | undefined {
    // temporarily get the last part to continue existing behavior
    const tempLastPart = styleTag.at(-1);
    if (tempLastPart === undefined) return undefined;
    return this.styleTagNameToFlatStyleMap.get(tempLastPart);
  }

  addNode(node: DagNode): void {
    this.curDag.addNode(node);
  }

  addEdge(edge: DagEdge): void {
    this.curDag.addEdge(edge);
  }

  addChildNamespace(childNamespace: NamespaceContext): void {
    const childDag = childNamespace.getCurDag();
    this.curDag.addChildDag(childDag);
    this.nsNameToChildNs.set(childDag.Name, childNamespace);
  }

  getCurDag(): Dag {
    return this.curDag;
  }
}

function processCall(
  callStmt: CallTreeNode,
  context: NamespaceContext,
): NodeId {
  type IncomingEdgeInfo = {
    nodeId: NodeId;
    varName: string;
    varStyle: StyleTreeNode | null;
  };
  const incomingEdgeInfoList: IncomingEdgeInfo[] = callStmt.ArgList.map((arg) =>
    match(arg.Type)
      .with(NodeType.Call, () => {
        const argNodeId = processCall(arg as CallTreeNode, context);
        return { nodeId: argNodeId, varName: "", varStyle: null };
      })
      .with(NodeType.QualifiedVariable, () => {
        const argVarName = arg as QualifiedVarTreeNode;
        const varName = argVarName.QualifiedVarName;
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
  context.addNode(thisNode);

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
    context.addEdge(thisEdge);
  });

  return thisNodeId;
}

export function makeNamespace(
  dagId: DagId,
  dagNamespaceStmt: NamespaceTreeNode,
  parentContext?: NamespaceContext,
): NamespaceContext {
  const dagStyleTags = dagNamespaceStmt.Styling?.StyleTagList ?? [];
  const dagStyleProperties = dagNamespaceStmt.Styling?.KeyValueMap ?? new Map();
  const curLevelDag = new Dag(
    dagId,
    parentContext?.getCurDag(),
    dagNamespaceStmt.Name,
    dagStyleTags,
    dagStyleProperties,
  );
  const namespaceContext = new NamespaceContext(curLevelDag, parentContext);

  function mergeMap<K, V>(mutableMap: Map<K, V>, mapToAdd: Map<K, V>): void {
    mapToAdd.forEach((value, key) => {
      mutableMap.set(key, value);
    });
  }

  dagNamespaceStmt.Statements.forEach((stmt) => {
    match(stmt.Type)
      .with(NodeType.Call, () => {
        const callStmt = stmt as CallTreeNode;
        processCall(callStmt, namespaceContext);
      })
      .with(NodeType.Assignment, () => {
        const assignmentStmt = stmt as AssignmentTreeNode;
        if (!assignmentStmt.Lhs || !assignmentStmt.Rhs) return;

        const thisNodeId = processCall(assignmentStmt.Rhs, namespaceContext);
        assignmentStmt.Lhs.forEach((lhsVar) => {
          namespaceContext.setVarNode(lhsVar.VarName, thisNodeId);
          if (lhsVar.Styling)
            namespaceContext.setVarStyle(lhsVar.VarName, lhsVar.Styling);
        });
      })
      .with(NodeType.Alias, () => {
        const aliasStmt = stmt as AliasTreeNode;
        if (!aliasStmt.Lhs || !aliasStmt.Rhs) return;

        const lhsName = aliasStmt.Lhs!.VarName;
        const rhsName = aliasStmt.Rhs!.QualifiedVarName;
        const RhsReferentNodeId = namespaceContext.getVarNode(rhsName);
        if (RhsReferentNodeId) {
          namespaceContext.setVarNode(lhsName, RhsReferentNodeId);
        } else {
          console.log(`var ${lhsName} not found`);
        }
        if (aliasStmt.Lhs.Styling)
          namespaceContext.setVarStyle(lhsName, aliasStmt.Lhs.Styling);
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
      .with(NodeType.QualifiedVariable, () => null)
      .with(NodeType.Namespace, () => {
        const namespaceStmt = stmt as NamespaceTreeNode;
        const thisNamespaceId = uuidv4();
        const childNamespace = makeNamespace(
          thisNamespaceId,
          namespaceStmt,
          namespaceContext,
        );
        namespaceContext.addChildNamespace(childNamespace);
      })
      .otherwise(() => {
        console.log("Unknown node type ", stmt.Type);
      });
  });
  return namespaceContext;
}

export function makeDag(recipe: RecipeTreeNode): Dag {
  return makeNamespace(
    TOP_LEVEL_DAG_ID,
    new NamespaceTreeNode("", recipe.Statements),
  ).getCurDag();
}
