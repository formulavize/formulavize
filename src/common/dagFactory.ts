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
} from "./ast";
import { Dag, NodeId, StyleProperties, DagId, DagStyle } from "./dag";
import { TOP_LEVEL_DAG_ID } from "./constants";

function makeDagStyle(styleNode: StyleTreeNode): DagStyle {
  return {
    styleTags: styleNode.StyleTagList,
    styleProperties: styleNode.KeyValueMap,
  };
}

function processCall(callStmt: CallTreeNode, workingDag: Dag): NodeId {
  type IncomingEdgeInfo = {
    nodeId: NodeId;
    varName: string;
    varStyle: DagStyle | null;
  };
  const incomingEdgeInfoList: IncomingEdgeInfo[] = callStmt.ArgList.map((arg) =>
    match(arg.Type)
      .with(NodeType.Call, () => {
        const argNodeId = processCall(arg as CallTreeNode, workingDag);
        return { nodeId: argNodeId, varName: "", varStyle: null };
      })
      .with(NodeType.QualifiedVariable, () => {
        const argVarName = arg as QualifiedVarTreeNode;
        const varName = argVarName.QualifiedVarName;
        const varStyle = workingDag.getVarStyle(varName) ?? null;
        const candidateSrcNodeId = workingDag.getVarNode(varName);
        if (!candidateSrcNodeId) {
          console.warn("Unable to find variable with name ", varName);
          return null;
        }
        return {
          nodeId: candidateSrcNodeId,
          varName: varName,
          varStyle: varStyle,
        };
      })
      .otherwise(() => {
        console.error("Unknown node type ", arg.Type);
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
      styleTags: incomingEdge.varStyle?.styleTags ?? [],
      styleProperties:
        incomingEdge.varStyle?.styleProperties ?? new Map<string, string>(),
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
  const dagStyleTags = dagNamespaceStmt.Styling?.StyleTagList ?? [];
  const dagStyleProperties = dagNamespaceStmt.Styling?.KeyValueMap ?? new Map();
  const curLevelDag = new Dag(
    dagId,
    parentDag,
    dagNamespaceStmt.Name,
    dagStyleTags,
    dagStyleProperties,
  );

  function mergeMap<K, V>(mutableMap: Map<K, V>, mapToAdd: Map<K, V>): void {
    mapToAdd.forEach((value, key) => {
      mutableMap.set(key, value);
    });
  }

  dagNamespaceStmt.Statements.forEach((stmt) => {
    match(stmt.Type)
      .with(NodeType.Call, () => {
        const callStmt = stmt as CallTreeNode;
        processCall(callStmt, curLevelDag);
      })
      .with(NodeType.Assignment, () => {
        const assignmentStmt = stmt as AssignmentTreeNode;
        if (!assignmentStmt.Lhs || !assignmentStmt.Rhs) return;

        const thisNodeId = processCall(assignmentStmt.Rhs, curLevelDag);
        assignmentStmt.Lhs.forEach((lhsVar) => {
          curLevelDag.setVarNode(lhsVar.VarName, thisNodeId);
          const varStyle = lhsVar.Styling ? makeDagStyle(lhsVar.Styling) : null;
          curLevelDag.setVarStyle(lhsVar.VarName, varStyle);
        });
      })
      .with(NodeType.Alias, () => {
        const aliasStmt = stmt as AliasTreeNode;
        if (!aliasStmt.Lhs || !aliasStmt.Rhs) return;

        const lhsName = aliasStmt.Lhs!.VarName;
        const rhsName = aliasStmt.Rhs!.QualifiedVarName;
        const RhsReferentNodeId = curLevelDag.getVarNode(rhsName);
        if (!RhsReferentNodeId) {
          console.warn(`var ${rhsName} not found`);
          return;
        }
        curLevelDag.setVarNode(lhsName, RhsReferentNodeId);

        const varStyle = aliasStmt.Lhs.Styling
          ? makeDagStyle(aliasStmt.Lhs.Styling)
          : null;
        curLevelDag.setVarStyle(lhsName, varStyle);
      })
      .with(NodeType.NamedStyle, () => {
        const namedStyleStmt = stmt as NamedStyleTreeNode;
        const styleNode = namedStyleStmt.StyleNode;
        const workingStyleProperties: StyleProperties = new Map();
        styleNode.StyleTagList.forEach((styleTag) => {
          const referentStyle = curLevelDag.getStyle(styleTag);
          if (!referentStyle) {
            // styles must be declared before usage
            console.warn(`styleTag ${styleTag} not found`);
            return;
          }
          mergeMap(workingStyleProperties, referentStyle);
        });
        // any locally defined properties will overwrite referenced styles
        mergeMap(workingStyleProperties, styleNode.KeyValueMap);
        const thisStyleTag = namedStyleStmt.StyleName;
        curLevelDag.setStyle(thisStyleTag, workingStyleProperties);
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
        const subDagId = uuidv4();
        const childDag = makeSubDag(subDagId, namespaceStmt, curLevelDag);
        curLevelDag.addChildDag(childDag);
      })
      .otherwise(() => {
        console.error("Unknown node type ", stmt.Type);
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
