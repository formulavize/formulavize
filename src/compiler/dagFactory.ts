import { match } from "ts-pattern";
import { v4 as uuidv4 } from "uuid";

import {
  BaseTreeNode,
  RecipeTreeNode,
  CallTreeNode,
  AssignmentTreeNode,
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
    styleTags: styleNode.StyleTagList.map((tag) => tag.QualifiedTagName),
    styleProperties: styleNode.KeyValueMap,
  };
}

type IncomingEdgeInfo = {
  nodeId: NodeId;
  varName: string;
  varStyle: DagStyle | null;
};

function makeError(
  node: BaseTreeNode,
  message: string,
  source: "Internal" | "Syntax" | "Reference" | "Import",
): Error {
  return {
    position: node.Position ?? DEFAULT_POSITION,
    message,
    severity: "error",
    source,
  };
}

function makeInternalError(node: BaseTreeNode, errorMsg: string): Error {
  return makeError(node, errorMsg, "Internal");
}

function makeSyntaxError(node: BaseTreeNode, message: string): Error {
  return makeError(node, message, "Syntax");
}

function makeRefError(node: BaseTreeNode, message: string): Error {
  return makeError(node, message, "Reference");
}

function makeImportError(node: BaseTreeNode, message: string): Error {
  return makeError(node, message, "Import");
}

function checkStyleTagsExist(
  styleNode: StyleTreeNode | null,
  workingDag: Dag | undefined,
  errors: Error[],
): void {
  // add error message if styleTags are not declared before usage
  if (!styleNode) return;
  styleNode.StyleTagList.forEach((styleTag) => {
    const styleTagName = styleTag.QualifiedTagName;
    if (!workingDag?.getStyle(styleTagName)) {
      const errMsg = makeRefError(
        styleTag,
        `Style tag '${styleTagName.join(".")}' not found`,
      );
      errors.push(errMsg);
      console.debug(errMsg);
    }
  });
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
            const errMsg = makeRefError(arg, `Variable '${varName}' not found`);
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
          const errMsg = makeInternalError(
            arg,
            `Unknown argument type '${arg.Type}'`,
          );
          errors.push(errMsg);
          console.error(errMsg);
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
  checkStyleTagsExist(callStmt.Styling, workingDag, errors);
  const thisNode = {
    id: thisNodeId,
    name: callStmt.Name,
    styleTags:
      callStmt.Styling?.StyleTagList.map((tag) => tag.QualifiedTagName) ?? [],
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
      const errMsg = makeImportError(importStmt, err.message);
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

async function processAssignmentRhs(
  rhsNode:
    | CallTreeNode
    | QualifiedVarTreeNode
    | NamespaceTreeNode
    | ImportTreeNode,
  workingDag: Dag,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string>,
): Promise<NodeId> {
  return match(rhsNode.Type)
    .with(NodeType.QualifiedVariable, () => {
      const rhsVar = rhsNode as QualifiedVarTreeNode;
      const varName = rhsVar.QualifiedVarName;
      const candidateSrcNodeId = workingDag.getVarNode(varName);
      if (!candidateSrcNodeId) {
        const errDescription = `Variable '${varName}' not found`;
        const errMsg = makeRefError(rhsNode, errDescription);
        errors.push(errMsg);
        console.debug(errMsg);
        return Promise.reject(errDescription);
      }
      return candidateSrcNodeId;
    })
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
      const errMsg = makeInternalError(
        rhsNode,
        `Invalid right hand side type '${rhsNode.Type}'`,
      );
      errors.push(errMsg);
      console.error(errMsg);
      return Promise.reject(`Invalid right hand side type '${rhsNode.Type}'`);
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
  checkStyleTagsExist(dagNamespaceStmt.Styling, parentDag, errors);
  const dagStyleTags =
    dagNamespaceStmt.Styling?.StyleTagList.map((tag) => tag.QualifiedTagName) ??
    [];
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
        const lhsIsEmpty = assignmentStmt.Lhs.length === 0;
        if (lhsIsEmpty) {
          const errMsg = makeSyntaxError(
            assignmentStmt,
            "Left hand side is missing",
          );
          errors.push(errMsg);
          console.debug(errMsg);
        }
        const rhsIsEmpty = !assignmentStmt.Rhs;
        if (rhsIsEmpty) {
          const errMsg = makeSyntaxError(
            assignmentStmt,
            "Right hand side is missing",
          );
          errors.push(errMsg);
          console.debug(errMsg);
        }
        if (lhsIsEmpty || rhsIsEmpty) {
          // skip processing if either side is empty
          return;
        }
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
          checkStyleTagsExist(lhsVar.Styling, curLevelDag, errors);
          const varStyle = lhsVar.Styling ? makeDagStyle(lhsVar.Styling) : null;
          curLevelDag.setVarStyle(lhsVar.VarName, varStyle);
        }
      })
      .with(NodeType.NamedStyle, () => {
        const namedStyleStmt = stmt as NamedStyleTreeNode;
        const styleNode = namedStyleStmt.StyleNode;
        checkStyleTagsExist(styleNode, curLevelDag, errors);
        const workingStyleProperties: StyleProperties =
          styleNode.StyleTagList.map(
            (tag) => curLevelDag.getStyle(tag.QualifiedTagName) ?? new Map(),
          ).reduce((acc, props) => new Map([...acc, ...props]), new Map());
        // any locally defined properties will overwrite referenced styles
        styleNode.KeyValueMap.forEach((value, key) => {
          workingStyleProperties.set(key, value);
        });
        const thisStyleTag = namedStyleStmt.StyleName;
        curLevelDag.setStyle(thisStyleTag, workingStyleProperties);
      })
      .with(NodeType.StyleBinding, () => {
        const styleBindingStmt = stmt as StyleBindingTreeNode;
        curLevelDag.addStyleBinding(
          styleBindingStmt.Keyword,
          styleBindingStmt.StyleTagList.map((tag) => tag.QualifiedTagName),
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
        const errMsg = makeInternalError(
          stmt,
          `Unknown statement type '${stmt.Type}'`,
        );
        errors.push(errMsg);
        console.error(errMsg);
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
