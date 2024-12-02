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
  ValueTreeNode,
  ImportTreeNode,
} from "./ast";
import { Dag, NodeId, StyleProperties, DagId, DagStyle } from "./dag";
import { TOP_LEVEL_DAG_ID } from "./constants";
import { ImportCacher } from "./importCacher";

function makeDagStyle(styleNode: StyleTreeNode): DagStyle {
  return {
    styleTags: styleNode.StyleTagList,
    styleProperties: styleNode.KeyValueMap,
  };
}

type IncomingEdgeInfo = {
  nodeId: NodeId;
  varName: string;
  varStyle: DagStyle | null;
};

function argListToEdgeInfo(
  argList: ValueTreeNode[],
  workingDag: Dag,
): IncomingEdgeInfo[] {
  return argList
    .map((arg) =>
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
            varName: varName.at(-1) ?? "",
            varStyle: varStyle,
          };
        })
        .otherwise(() => {
          console.error("Unknown node type ", arg.Type);
          return null;
        }),
    )
    .filter(Boolean) as IncomingEdgeInfo[];
}

function addIncomingEdgesToDag(
  incomingEdges: IncomingEdgeInfo[],
  destNodeId: NodeId,
  workingDag: Dag,
): void {
  incomingEdges.forEach((incomingEdge) => {
    const edgeId = uuidv4();
    const thisEdge = {
      id: edgeId,
      name: incomingEdge.varName,
      srcNodeId: incomingEdge.nodeId,
      destNodeId: destNodeId,
      styleTags: incomingEdge.varStyle?.styleTags ?? [],
      styleProperties:
        incomingEdge.varStyle?.styleProperties ?? new Map<string, string>(),
    };
    workingDag.addEdge(thisEdge);
  });
}

function processCall(callStmt: CallTreeNode, workingDag: Dag): NodeId {
  const thisNodeId = uuidv4();
  const thisNode = {
    id: thisNodeId,
    name: callStmt.Name,
    styleTags: callStmt.Styling?.StyleTagList ?? [],
    styleProperties: callStmt.Styling?.KeyValueMap ?? new Map<string, string>(),
  };
  workingDag.addNode(thisNode);

  const incomingEdgeInfoList = argListToEdgeInfo(callStmt.ArgList, workingDag);
  addIncomingEdgesToDag(incomingEdgeInfoList, thisNodeId, workingDag);

  return thisNodeId;
}

function proccessNamespace(
  namespaceStmt: NamespaceTreeNode,
  workingDag: Dag,
  importer: ImportCacher,
): NodeId {
  const subDagId = uuidv4();
  const childDag = makeSubDag(subDagId, namespaceStmt, importer, workingDag);
  workingDag.addChildDag(childDag);

  const dagIncomingEdges = argListToEdgeInfo(namespaceStmt.ArgList, workingDag);
  addIncomingEdgesToDag(dagIncomingEdges, subDagId, workingDag);

  return subDagId;
}

export function makeSubDag(
  dagId: DagId,
  dagNamespaceStmt: NamespaceTreeNode,
  importer: ImportCacher,
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

  function processAssignmentRhs(
    rhsNode: CallTreeNode | NamespaceTreeNode,
    workingDag: Dag,
  ): NodeId | null {
    return match(rhsNode.Type)
      .with(NodeType.Call, () => {
        return processCall(rhsNode as CallTreeNode, workingDag);
      })
      .with(NodeType.Namespace, () => {
        return proccessNamespace(
          rhsNode as NamespaceTreeNode,
          workingDag,
          importer,
        );
      })
      .otherwise(() => {
        console.error("Unknown node type ", rhsNode.Type);
        return null;
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
        const thisNodeId = processAssignmentRhs(
          assignmentStmt.Rhs,
          curLevelDag,
        );
        if (!thisNodeId) return;
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
        proccessNamespace(namespaceStmt, curLevelDag, importer);
      })
      .with(NodeType.Import, async () => {
        const importStmt = stmt as ImportTreeNode;
        const importedDag = await importer
          .getPackage(importStmt.ImportLocation)
          .catch((err) => {
            console.warn("Import failed: ", err);
            return null;
          });
        if (!importedDag) return;
        if (importStmt.ImportAlias) {
          importedDag.Id = uuidv4();
          importedDag.Name = importStmt.ImportAlias;
          curLevelDag.addChildDag(importedDag);
        } else {
          curLevelDag.mergeDag(importedDag);
        }
      })
      .otherwise(() => {
        console.error("Unknown node type ", stmt.Type);
      });
  });
  return curLevelDag;
}

export function makeDag(recipe: RecipeTreeNode, importer: ImportCacher): Dag {
  return makeSubDag(
    TOP_LEVEL_DAG_ID,
    new NamespaceTreeNode("", recipe.Statements),
    importer,
  );
}
