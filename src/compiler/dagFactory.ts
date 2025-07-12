import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";

import {
  BaseTreeNode,
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
import { ImportCacher } from "./importCacher";
import {
  CompilationError as Error,
  DEFAULT_POSITION,
} from "./compilationErrors";

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

function makeDagError(node: BaseTreeNode, message: string): Error {
  return {
    position: node.Position ?? DEFAULT_POSITION,
    message: message,
    severity: "error",
    source: "DAG",
  };
}

function argListToEdgeInfo(
  argList: ValueTreeNode[],
  workingDag: Dag,
  errors: Error[],
): IncomingEdgeInfo[] {
  return argList
    .map((arg) =>
      match(arg.Type)
        .with(NodeType.Call, () => {
          const argNodeId = processCall(
            arg as CallTreeNode,
            workingDag,
            errors,
          );
          return { nodeId: argNodeId, varName: "", varStyle: null };
        })
        .with(NodeType.QualifiedVariable, () => {
          const argVarName = arg as QualifiedVarTreeNode;
          const varName = argVarName.QualifiedVarName;
          const varStyle = workingDag.getVarStyle(varName) ?? null;
          const candidateSrcNodeId = workingDag.getVarNode(varName);
          if (!candidateSrcNodeId) {
            const errMsg = makeDagError(arg, `Variable ${varName} not found`);
            errors.push(errMsg);
            console.debug(errMsg);
            return null;
          }
          return {
            nodeId: candidateSrcNodeId,
            varName: varName.at(-1) ?? "",
            varStyle: varStyle,
          };
        })
        .otherwise(() => {
          const errMsg = makeDagError(arg, `Unknown argument type ${arg.Type}`);
          errors.push(errMsg);
          console.debug(errMsg);
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

function processCall(
  callStmt: CallTreeNode,
  workingDag: Dag,
  errors: Error[],
): NodeId {
  const thisNodeId = uuidv4();
  const thisNode = {
    id: thisNodeId,
    name: callStmt.Name,
    styleTags: callStmt.Styling?.StyleTagList ?? [],
    styleProperties: callStmt.Styling?.KeyValueMap ?? new Map<string, string>(),
  };
  workingDag.addNode(thisNode);

  const incomingEdgeInfoList = argListToEdgeInfo(
    callStmt.ArgList,
    workingDag,
    errors,
  );
  addIncomingEdgesToDag(incomingEdgeInfoList, thisNodeId, workingDag);

  return thisNodeId;
}

async function processNamespace(
  namespaceStmt: NamespaceTreeNode,
  workingDag: Dag,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string>,
): Promise<NodeId> {
  const subDagId = uuidv4();
  const childDag = makeSubDag(
    subDagId,
    namespaceStmt,
    errors,
    importer,
    seenImports,
    workingDag,
  );
  workingDag.addChildDag(await childDag);

  const dagIncomingEdges = argListToEdgeInfo(
    namespaceStmt.ArgList,
    workingDag,
    errors,
  );
  addIncomingEdgesToDag(dagIncomingEdges, subDagId, workingDag);

  return subDagId;
}

async function getImportedDag(
  importStmt: ImportTreeNode,
  importer: ImportCacher,
  errors: Error[],
  workingDag: Dag,
  seenImports: Set<string>,
): Promise<Dag> {
  // Imports are processed sequentially to ensure order is respected.
  // Hoisting and parallelizing would be faster, but could result in
  // incorrect behavior if the order of imports matters.
  workingDag.addUsedImport(importStmt.ImportLocation);
  return importer
    .getPackageDag(importStmt.ImportLocation, seenImports)
    .catch((err) => {
      const errMsg = makeDagError(importStmt, `Import failed: ${err}`);
      errors.push(errMsg);
      console.debug(errMsg);
      return Promise.reject(err);
    });
}

async function processImport(
  importStmt: ImportTreeNode,
  workingDag: Dag,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string>,
): Promise<NodeId> {
  // Process imports referenced by a variable, always returning a node id
  const importedDag = await getImportedDag(
    importStmt,
    importer,
    errors,
    workingDag,
    seenImports,
  );
  importedDag.Id = uuidv4();
  importedDag.Name = importStmt.ImportName ?? "";
  workingDag.addChildDag(importedDag);
  return importedDag.Id;
}

async function processUnassignedImport(
  importStmt: ImportTreeNode,
  workingDag: Dag,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string>,
) {
  // Process imports not referenced by a variable
  const importedDag = await getImportedDag(
    importStmt,
    importer,
    errors,
    workingDag,
    seenImports,
  );
  if (importStmt.ImportName) {
    importedDag.Id = uuidv4();
    importedDag.Name = importStmt.ImportName;
    workingDag.addChildDag(importedDag);
  } else {
    workingDag.mergeDag(importedDag);
  }
}

function mergeMap<K, V>(mutableMap: Map<K, V>, mapToAdd: Map<K, V>): void {
  mapToAdd.forEach((value, key) => {
    mutableMap.set(key, value);
  });
}

async function processAssignmentRhs(
  rhsNode: CallTreeNode | NamespaceTreeNode | ImportTreeNode,
  workingDag: Dag,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string>,
): Promise<NodeId> {
  return match(rhsNode.Type)
    .with(NodeType.Call, () => {
      return processCall(rhsNode as CallTreeNode, workingDag, errors);
    })
    .with(NodeType.Namespace, () => {
      return processNamespace(
        rhsNode as NamespaceTreeNode,
        workingDag,
        errors,
        importer,
        seenImports,
      );
    })
    .with(NodeType.Import, async () => {
      return processImport(
        rhsNode as ImportTreeNode,
        workingDag,
        errors,
        importer,
        seenImports,
      );
    })
    .otherwise(() => {
      const errMsg = makeDagError(
        rhsNode,
        `Invalid right hand side type ${rhsNode.Type}`,
      );
      errors.push(errMsg);
      console.debug(errMsg);
      return Promise.reject(`Invalid right hand side type ${rhsNode.Type}`);
    });
}

export async function makeSubDag(
  dagId: DagId,
  dagNamespaceStmt: NamespaceTreeNode,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string> = new Set(),
  parentDag?: Dag,
): Promise<Dag> {
  const dagStyleTags = dagNamespaceStmt.Styling?.StyleTagList ?? [];
  const dagStyleProperties = dagNamespaceStmt.Styling?.KeyValueMap ?? new Map();
  const curLevelDag = new Dag(
    dagId,
    parentDag,
    dagNamespaceStmt.Name,
    dagStyleTags,
    dagStyleProperties,
  );

  for (const stmt of dagNamespaceStmt.Statements) {
    await match(stmt.Type)
      .with(NodeType.Call, () => {
        const callStmt = stmt as CallTreeNode;
        processCall(callStmt, curLevelDag, errors);
      })
      .with(NodeType.Assignment, async () => {
        const assignmentStmt = stmt as AssignmentTreeNode;
        if (!assignmentStmt.Lhs || !assignmentStmt.Rhs) return;
        const thisNodeId = await processAssignmentRhs(
          assignmentStmt.Rhs,
          curLevelDag,
          errors,
          importer,
          seenImports,
        ).catch((err) => {
          console.debug("Assignment failure:", err);
          return null;
        });
        if (!thisNodeId) return;
        for (const lhsVar of assignmentStmt.Lhs) {
          curLevelDag.setVarNode(lhsVar.VarName, thisNodeId);
          const varStyle = lhsVar.Styling ? makeDagStyle(lhsVar.Styling) : null;
          curLevelDag.setVarStyle(lhsVar.VarName, varStyle);
        }
      })
      .with(NodeType.Alias, () => {
        const aliasStmt = stmt as AliasTreeNode;
        if (!aliasStmt.Lhs || !aliasStmt.Rhs) return;

        const lhsName = aliasStmt.Lhs!.VarName;
        const rhsName = aliasStmt.Rhs!.QualifiedVarName;
        const RhsReferentNodeId = curLevelDag.getVarNode(rhsName);
        if (!RhsReferentNodeId) {
          const errMsg = makeDagError(
            aliasStmt.Rhs,
            `Variable ${rhsName} not found for alias ${lhsName}`,
          );
          errors.push(errMsg);
          console.debug(errMsg);
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
            const errMsg = makeDagError(
              styleNode,
              `Style tag ${styleTag} not found`,
            );
            errors.push(errMsg);
            console.debug(errMsg);
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
      .with(NodeType.Namespace, async () => {
        const namespaceStmt = stmt as NamespaceTreeNode;
        await processNamespace(
          namespaceStmt,
          curLevelDag,
          errors,
          importer,
          seenImports,
        );
      })
      .with(NodeType.Import, async () => {
        const importStmt = stmt as ImportTreeNode;
        await processUnassignedImport(
          importStmt,
          curLevelDag,
          errors,
          importer,
          seenImports,
        ).catch((err) => {
          console.debug(err);
        });
      })
      .otherwise(() => {
        const errMsg = makeDagError(
          stmt,
          `Unknown statement type ${stmt.Type}`,
        );
        errors.push(errMsg);
        console.debug(errMsg);
      });
  }
  return curLevelDag;
}

export async function makeDag(
  recipe: RecipeTreeNode,
  importer: ImportCacher,
  seenImports: Set<string> = new Set(),
): Promise<{ dag: Dag; errors: Error[] }> {
  const errors: Error[] = [];
  const dag = await makeSubDag(
    uuidv4(),
    new NamespaceTreeNode("", recipe.Statements),
    errors,
    importer,
    seenImports,
  );
  return { dag, errors };
}
