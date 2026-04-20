import { match } from "ts-pattern";

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
  GlobalStyleBindingTreeNode,
  NamespaceTreeNode,
  ValueTreeNode,
  ImportTreeNode,
  StatementListTreeNode,
} from "./ast";
import { Dag, NodeId, StyleProperties, DagId, DagStyle } from "./dag";
import { GLOBAL_STYLE_KEYWORD_MAP } from "./constants";
import { ImportCacher } from "./importCacher";
import {
  CompilationError as Error,
  DEFAULT_POSITION,
  ErrorCode,
  ErrorSource,
} from "./compilationErrors";

export enum ScopeKind {
  Namespace = "ns",
  Import = "i",
}

// Stable Ids enable consistent node and edge IDs across compilations,
// which allows the renderer to preserve element positions and styles
// when the underlying DAG structure hasn't changed.
// Ids are generated based on the path to the current scope
// (e.g. root-n-a-0 for the first call to 'a' at the root level)
// and a count of how many times that scope has been entered
// (e.g. root-ns-a-0-n-a-0 for the first call to 'a' inside a namespace 'a').
// DagFactory previously had a simpler, less stateful approach of generating UUIDs,
// but that caused the entire graph to be treated as new on every compilation,
// which made it impossible to preserve element positions and styles across compilations.
export class StableIdContext {
  private scopePath: string;
  private nodeCounts = new Map<string, number>();
  private edgeCounts = new Map<string, number>();
  private childScopeCounts = new Map<string, number>();

  constructor(scopePath: string) {
    this.scopePath = scopePath;
  }

  get ScopePath(): string {
    return this.scopePath;
  }

  nextNodeId(callName: string): string {
    const count = this.nodeCounts.get(callName) ?? 0;
    this.nodeCounts.set(callName, count + 1);
    return `${this.scopePath}-n-${callName}-${count}`;
  }

  nextEdgeId(srcNodeId: string, destNodeId: string): string {
    const key = `${srcNodeId}>${destNodeId}`;
    const count = this.edgeCounts.get(key) ?? 0;
    this.edgeCounts.set(key, count + 1);
    return `${this.scopePath}-e-${key}-${count}`;
  }

  childScope(kind: ScopeKind, name: string): StableIdContext {
    const key = `${kind}-${name}`;
    const count = this.childScopeCounts.get(key) ?? 0;
    this.childScopeCounts.set(key, count + 1);
    return new StableIdContext(`${this.scopePath}-${key}-${count}`);
  }
}

function makeDagStyle(styleNode: StyleTreeNode): DagStyle {
  return {
    styleTags: styleNode.StyleTags.map((tag) => tag.QualifiedTagName),
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
  source: ErrorSource,
  code?: ErrorCode,
): Error {
  return {
    position: node.Position ?? DEFAULT_POSITION,
    message,
    severity: "error",
    source,
    code,
  };
}

function checkStyleTagsInStyleNode(
  styleNode: StyleTreeNode | null,
  workingDag: Dag | undefined,
  errors: Error[],
): void {
  if (!styleNode) return;
  styleNode.StyleTags.forEach((styleTag) => {
    const styleTagName = styleTag.QualifiedTagName;
    if (!workingDag?.getStyle(styleTagName)) {
      const errMsg = makeError(
        styleTag,
        `Style tag '${styleTagName.join(".")}' not found`,
        ErrorSource.Reference,
        ErrorCode.StyleTagNotFound,
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
  ctx: StableIdContext,
): IncomingEdgeInfo[] {
  return argList
    .map((arg) =>
      match(arg.Type)
        .with(NodeType.Call, () => {
          const argNodeId = processCall(
            arg as CallTreeNode,
            workingDag,
            errors,
            ctx,
          );
          return { nodeId: argNodeId, varName: "", varStyle: null };
        })
        .with(NodeType.QualifiedVariable, () => {
          const argVarName = arg as QualifiedVarTreeNode;
          const varName = argVarName.QualifiedVarName;
          const varStyle = workingDag.getVarStyle(varName) ?? null;
          const candidateSrcNodeId = workingDag.getVarNode(varName);
          if (!candidateSrcNodeId) {
            const errMsg = makeError(
              arg,
              `Variable '${varName}' not found`,
              ErrorSource.Reference,
              ErrorCode.VariableNotFound,
            );
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
          const errMsg = makeError(
            arg,
            `Unknown argument type '${arg.Type}'`,
            ErrorSource.Internal,
            ErrorCode.UnknownArgumentType,
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
  ctx: StableIdContext,
): void {
  incomingEdges.forEach((incomingEdge) => {
    const edgeId = ctx.nextEdgeId(incomingEdge.nodeId, destNodeId);
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
  ctx: StableIdContext,
): NodeId {
  const thisNodeId = ctx.nextNodeId(callStmt.Name);
  checkStyleTagsInStyleNode(callStmt.Styling, workingDag, errors);
  const thisNode = {
    id: thisNodeId,
    name: callStmt.Name,
    styleTags:
      callStmt.Styling?.StyleTags.map((tag) => tag.QualifiedTagName) ?? [],
    styleProperties: callStmt.Styling?.KeyValueMap ?? new Map<string, string>(),
  };
  workingDag.addNode(thisNode);

  const incomingEdgeInfoList = argListToEdgeInfo(
    callStmt.Args,
    workingDag,
    errors,
    ctx,
  );
  addIncomingEdgesToDag(incomingEdgeInfoList, thisNodeId, workingDag, ctx);

  return thisNodeId;
}

async function processNamespace(
  namespaceStmt: NamespaceTreeNode,
  workingDag: Dag,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string>,
  ctx: StableIdContext,
): Promise<NodeId> {
  const childCtx = ctx.childScope(ScopeKind.Namespace, namespaceStmt.Name);
  const subDagId = childCtx.ScopePath;
  const childDag = makeSubDag(
    subDagId,
    namespaceStmt,
    errors,
    importer,
    seenImports,
    workingDag,
    childCtx,
  );
  workingDag.addChildDag(await childDag);

  const dagIncomingEdges = argListToEdgeInfo(
    namespaceStmt.Args,
    workingDag,
    errors,
    ctx,
  );
  addIncomingEdgesToDag(dagIncomingEdges, subDagId, workingDag, ctx);

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
      const errMsg = makeError(
        importStmt,
        err.message,
        ErrorSource.Import,
        ErrorCode.ImportFetchFailed,
      );
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
  ctx: StableIdContext,
): Promise<NodeId> {
  // Process imports referenced by a variable, always returning a node id
  const importedDag = await getImportedDag(
    importStmt,
    importer,
    errors,
    workingDag,
    seenImports,
  );
  const importName = importStmt.ImportName ?? importStmt.ImportLocation;
  importedDag.Id = ctx.childScope(ScopeKind.Import, importName).ScopePath;
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
  ctx: StableIdContext,
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
    importedDag.Id = ctx.childScope(
      ScopeKind.Import,
      importStmt.ImportName,
    ).ScopePath;
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
  ctx: StableIdContext,
): Promise<NodeId> {
  return match(rhsNode.Type)
    .with(NodeType.QualifiedVariable, () => {
      const rhsVar = rhsNode as QualifiedVarTreeNode;
      const varName = rhsVar.QualifiedVarName;
      const candidateSrcNodeId = workingDag.getVarNode(varName);
      if (!candidateSrcNodeId) {
        const errDescription = `Variable '${varName}' not found`;
        const errMsg = makeError(
          rhsNode,
          errDescription,
          ErrorSource.Reference,
          ErrorCode.VariableNotFound,
        );
        errors.push(errMsg);
        console.debug(errMsg);
        return Promise.reject(errDescription);
      }
      return candidateSrcNodeId;
    })
    .with(NodeType.Call, () => {
      return processCall(rhsNode as CallTreeNode, workingDag, errors, ctx);
    })
    .with(NodeType.Namespace, () => {
      return processNamespace(
        rhsNode as NamespaceTreeNode,
        workingDag,
        errors,
        importer,
        seenImports,
        ctx,
      );
    })
    .with(NodeType.Import, async () => {
      return processImport(
        rhsNode as ImportTreeNode,
        workingDag,
        errors,
        importer,
        seenImports,
        ctx,
      );
    })
    .otherwise(() => {
      const errMsg = makeError(
        rhsNode,
        `Invalid right hand side type '${rhsNode.Type}'`,
        ErrorSource.Internal,
        ErrorCode.InvalidRhsType,
      );
      errors.push(errMsg);
      console.error(errMsg);
      return Promise.reject(`Invalid right hand side type '${rhsNode.Type}'`);
    });
}

async function processAssignment(
  assignmentStmt: AssignmentTreeNode,
  workingDag: Dag,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string>,
  ctx: StableIdContext,
): Promise<void> {
  const lhsIsEmpty = assignmentStmt.Lhs.length === 0;
  if (lhsIsEmpty) {
    const errMsg = makeError(
      assignmentStmt,
      "Left hand side is missing",
      ErrorSource.Syntax,
      ErrorCode.MissingLhs,
    );
    errors.push(errMsg);
    console.debug(errMsg);
  }
  const rhsIsEmpty = !assignmentStmt.Rhs;
  if (rhsIsEmpty) {
    const errMsg = makeError(
      assignmentStmt,
      "Right hand side is missing",
      ErrorSource.Syntax,
      ErrorCode.MissingRhs,
    );
    errors.push(errMsg);
    console.debug(errMsg);
  }
  if (lhsIsEmpty || rhsIsEmpty) return;

  const thisNodeId = await processAssignmentRhs(
    assignmentStmt.Rhs,
    workingDag,
    errors,
    importer,
    seenImports,
    ctx,
  ).catch((err) => {
    console.debug("Assignment failure:", err);
    return null;
  });
  if (!thisNodeId) return;
  for (const lhsVar of assignmentStmt.Lhs) {
    workingDag.setVarNode(lhsVar.VarName, thisNodeId);
    checkStyleTagsInStyleNode(lhsVar.Styling, workingDag, errors);
    const varStyle = lhsVar.Styling ? makeDagStyle(lhsVar.Styling) : null;
    workingDag.setVarStyle(lhsVar.VarName, varStyle);
  }
}

function processNamedStyle(
  namedStyleStmt: NamedStyleTreeNode,
  workingDag: Dag,
  errors: Error[],
): void {
  const styleNode = namedStyleStmt.StyleNode;
  checkStyleTagsInStyleNode(styleNode, workingDag, errors);
  const workingStyleProperties: StyleProperties = styleNode.StyleTags.map(
    (tag) => workingDag.getStyle(tag.QualifiedTagName) ?? new Map(),
  ).reduce((acc, props) => new Map([...acc, ...props]), new Map());
  styleNode.KeyValueMap.forEach((value, key) => {
    workingStyleProperties.set(key, value);
  });
  workingDag.setStyle(namedStyleStmt.StyleName, workingStyleProperties);
}

function processStyleBinding(
  styleBindingStmt: StyleBindingTreeNode,
  workingDag: Dag,
  errors: Error[],
): void {
  const styleNode = styleBindingStmt.StyleNode;
  checkStyleTagsInStyleNode(styleNode, workingDag, errors);
  workingDag.addStyleBinding(styleBindingStmt.Keyword, makeDagStyle(styleNode));
}

function processGlobalStyleBinding(
  globalStyleBindingStmt: GlobalStyleBindingTreeNode,
  workingDag: Dag,
  errors: Error[],
): void {
  const keyword = globalStyleBindingStmt.Keyword;
  const canonicalKeyword = GLOBAL_STYLE_KEYWORD_MAP.get(keyword);
  if (!canonicalKeyword) {
    const errMsg = makeError(
      globalStyleBindingStmt,
      `Invalid global style binding keyword '${keyword}'`,
      ErrorSource.Syntax,
      ErrorCode.InvalidGlobalStyleKeyword,
    );
    errors.push(errMsg);
    console.debug(errMsg);
    return;
  }
  const styleNode = globalStyleBindingStmt.StyleNode;
  checkStyleTagsInStyleNode(styleNode, workingDag, errors);
  workingDag.addGlobalStyleBinding(canonicalKeyword, makeDagStyle(styleNode));
}

async function processStatement(
  stmt: BaseTreeNode,
  workingDag: Dag,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string>,
  ctx: StableIdContext,
): Promise<void> {
  await match(stmt.Type)
    .with(NodeType.Call, () => {
      processCall(stmt as CallTreeNode, workingDag, errors, ctx);
    })
    .with(NodeType.Assignment, async () => {
      await processAssignment(
        stmt as AssignmentTreeNode,
        workingDag,
        errors,
        importer,
        seenImports,
        ctx,
      );
    })
    .with(NodeType.NamedStyle, () => {
      processNamedStyle(stmt as NamedStyleTreeNode, workingDag, errors);
    })
    .with(NodeType.StyleBinding, () => {
      processStyleBinding(stmt as StyleBindingTreeNode, workingDag, errors);
    })
    .with(NodeType.GlobalStyleBinding, () => {
      processGlobalStyleBinding(
        stmt as GlobalStyleBindingTreeNode,
        workingDag,
        errors,
      );
    })
    .with(NodeType.QualifiedVariable, () => null)
    .with(NodeType.Namespace, async () => {
      await processNamespace(
        stmt as NamespaceTreeNode,
        workingDag,
        errors,
        importer,
        seenImports,
        ctx,
      );
    })
    .with(NodeType.Import, async () => {
      await processUnassignedImport(
        stmt as ImportTreeNode,
        workingDag,
        errors,
        importer,
        seenImports,
        ctx,
      ).catch((err) => {
        console.debug(err);
      });
    })
    .otherwise(() => {
      const errMsg = makeError(
        stmt,
        `Unknown statement type '${stmt.Type}'`,
        ErrorSource.Internal,
        ErrorCode.UnknownStatementType,
      );
      errors.push(errMsg);
      console.error(errMsg);
    });
}

export async function makeSubDag(
  dagId: DagId,
  dagNamespaceStmt: NamespaceTreeNode,
  errors: Error[],
  importer: ImportCacher,
  seenImports: Set<string> = new Set(),
  parentDag?: Dag,
  ctx?: StableIdContext,
): Promise<Dag> {
  const idCtx = ctx ?? new StableIdContext(dagId);
  checkStyleTagsInStyleNode(dagNamespaceStmt.Styling, parentDag, errors);
  const dagStyleTags =
    dagNamespaceStmt.Styling?.StyleTags.map((tag) => tag.QualifiedTagName) ??
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
    await processStatement(
      stmt,
      curLevelDag,
      errors,
      importer,
      seenImports,
      idCtx,
    );
  }
  return curLevelDag;
}

export async function makeDag(
  recipe: RecipeTreeNode,
  importer: ImportCacher,
  seenImports: Set<string> = new Set(),
): Promise<{ dag: Dag; errors: Error[] }> {
  const errors: Error[] = [];
  const rootCtx = new StableIdContext("root");
  const statementList = new StatementListTreeNode(
    recipe.Statements,
    recipe.Position,
  );
  const dag = await makeSubDag(
    "root",
    new NamespaceTreeNode("", statementList),
    errors,
    importer,
    seenImports,
    undefined,
    rootCtx,
  );
  return { dag, errors };
}
