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
  RendererDirectiveTreeNode,
  AboutNoteTreeNode,
  NamespaceTreeNode,
  ValueTreeNode,
  ImportTreeNode,
  StatementListTreeNode,
} from "./ast";
import { Dag, NodeId, StyleProperties, DagId, DagStyle } from "./dag";
import { GLOBAL_STYLE_KEYWORD_MAP } from "./constants";
import { ImportResolver } from "./importCacher";
import {
  CompilationError as Error,
  DEFAULT_POSITION,
  ErrorCode,
  ErrorSource,
  ImportError,
  describeError,
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

// What every statement handler needs beyond the statement itself and the dag it
// is building into: where diagnostics go, how an import statement reaches a
// package, which packages are already being imported above this one, and the
// id context naming this scope's elements. The dag stays a separate argument
// because it is the thing being mutated, and because a handler sometimes has
// to reach for a different one than the scope it is in (makeSubDag resolves a
// namespace's own style tags against its parent).
interface BuildContext {
  errors: Error[];
  resolveImport: ImportResolver;
  importChain: ReadonlySet<string>;
  ids: StableIdContext;
}

// Entering a namespace: same diagnostics, same resolver, same import chain --
// only the ids change. An import is the other kind of descent and deliberately
// does not come through here: it starts a build of its own, with a fresh error
// list and this package added to the chain (see getImportedDag).
function enterScope(
  ctx: BuildContext,
  kind: ScopeKind,
  name: string,
): BuildContext {
  return { ...ctx, ids: ctx.ids.childScope(kind, name) };
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

function reportError(
  ctx: BuildContext,
  node: BaseTreeNode,
  message: string,
  source: ErrorSource,
  code?: ErrorCode,
  severity: Error["severity"] = "error",
): void {
  const errMsg: Error = {
    position: node.Position ?? DEFAULT_POSITION,
    message,
    severity,
    source,
    code,
  };
  ctx.errors.push(errMsg);
  if (source === ErrorSource.Internal) console.error(errMsg);
  else console.debug(errMsg);
}

function checkStyleTagsInStyleNode(
  styleNode: StyleTreeNode | null,
  workingDag: Dag | undefined,
  ctx: BuildContext,
): void {
  if (!styleNode) return;
  styleNode.StyleTags.forEach((styleTag) => {
    const styleTagName = styleTag.QualifiedTagName;
    if (!workingDag?.getStyle(styleTagName)) {
      reportError(
        ctx,
        styleTag,
        `Style tag '${styleTagName.join(".")}' not found`,
        ErrorSource.Reference,
        ErrorCode.StyleTagNotFound,
      );
    }
  });
}

function argListToEdgeInfo(
  argList: ValueTreeNode[],
  workingDag: Dag,
  ctx: BuildContext,
): IncomingEdgeInfo[] {
  return argList
    .map((arg) =>
      match(arg.Type)
        .with(NodeType.Call, () => {
          const argNodeId = processCall(arg as CallTreeNode, workingDag, ctx);
          return { nodeId: argNodeId, varName: "", varStyle: null };
        })
        .with(NodeType.QualifiedVariable, () => {
          const argVarName = arg as QualifiedVarTreeNode;
          const varName = argVarName.QualifiedVarName;
          const varStyle = workingDag.getVarStyle(varName) ?? null;
          const candidateSrcNodeId = workingDag.getVarNode(varName);
          if (!candidateSrcNodeId) {
            reportError(
              ctx,
              arg,
              `Variable '${varName}' not found`,
              ErrorSource.Reference,
              ErrorCode.VariableNotFound,
            );
            return null;
          }
          return {
            nodeId: candidateSrcNodeId,
            varName: varName.at(-1) ?? "",
            varStyle: varStyle,
          };
        })
        .otherwise(() => {
          reportError(
            ctx,
            arg,
            `Unknown argument type '${arg.Type}'`,
            ErrorSource.Internal,
            ErrorCode.UnknownArgumentType,
          );
          return null;
        }),
    )
    .filter(Boolean) as IncomingEdgeInfo[];
}

function addIncomingEdgesToDag(
  incomingEdges: IncomingEdgeInfo[],
  destNodeId: NodeId,
  workingDag: Dag,
  ctx: BuildContext,
): void {
  incomingEdges.forEach((incomingEdge) => {
    const edgeId = ctx.ids.nextEdgeId(incomingEdge.nodeId, destNodeId);
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
  ctx: BuildContext,
): NodeId {
  const thisNodeId = ctx.ids.nextNodeId(callStmt.Name);
  checkStyleTagsInStyleNode(callStmt.Styling, workingDag, ctx);
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
    ctx,
  );
  addIncomingEdgesToDag(incomingEdgeInfoList, thisNodeId, workingDag, ctx);

  return thisNodeId;
}

async function processNamespace(
  namespaceStmt: NamespaceTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): Promise<NodeId> {
  const childCtx = enterScope(ctx, ScopeKind.Namespace, namespaceStmt.Name);
  const subDagId = childCtx.ids.ScopePath;
  const childDag = await makeSubDag(
    subDagId,
    namespaceStmt,
    childCtx,
    workingDag,
  );
  workingDag.addChildDag(childDag);

  const dagIncomingEdges = argListToEdgeInfo(
    namespaceStmt.Args,
    workingDag,
    ctx,
  );
  addIncomingEdgesToDag(dagIncomingEdges, subDagId, workingDag, ctx);

  return subDagId;
}

function reportImportedErrors(
  importStmt: ImportTreeNode,
  importedErrors: Error[],
  ctx: BuildContext,
): void {
  // Surface that an imported package did not compile cleanly, which would
  // otherwise render as a silently empty or partial subgraph.
  // The imported errors' own positions index the imported file's text, not the
  // editor's document, so they are never forwarded: one aggregated diagnostic
  // is reported against the import statement instead.
  if (importedErrors.length === 0) return;
  reportError(
    ctx,
    importStmt,
    `Imported package '${importStmt.ImportLocation}' reported ` +
      `${importedErrors.length} issue(s): ${importedErrors[0].message}`,
    ErrorSource.Import,
    undefined,
    "warning",
  );
}

// Resolves an import and builds its contents as a dag of their own. Returns
// null when the package could not be resolved: the diagnostic has already been
// reported against the import statement, so a caller's only job is to stop.
async function getImportedDag(
  importStmt: ImportTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): Promise<Dag | null> {
  // Imports are processed sequentially to ensure order is respected.
  // Hoisting and parallelizing would be faster, but could result in
  // incorrect behavior if the order of imports matters.
  const packageLocation = importStmt.ImportLocation;
  workingDag.addUsedImport(packageLocation);
  const resolved = await ctx
    .resolveImport(packageLocation, ctx.importChain)
    .catch((err) => {
      reportError(
        ctx,
        importStmt,
        describeError(err),
        ErrorSource.Import,
        err instanceof ImportError ? err.code : ErrorCode.ImportFetchFailed,
      );
      return null;
    });
  if (!resolved) return null;
  // The package's contents are built here rather than reused from a cache,
  // under a scope belonging to this import site, so two sites importing one
  // package get their own ids instead of two subgraphs that collide. The
  // scope is taken after the resolve, so a failed import consumes no counter.
  const importedErrors: Error[] = [];
  const dag = await buildDag(resolved.ast, {
    errors: importedErrors,
    resolveImport: ctx.resolveImport,
    importChain: new Set([...ctx.importChain, packageLocation]),
    ids: ctx.ids.childScope(
      ScopeKind.Import,
      importStmt.ImportName ?? packageLocation,
    ),
  });
  reportImportedErrors(
    importStmt,
    [...resolved.errors, ...importedErrors],
    ctx,
  );
  return dag;
}

// An import's contents keep a scope of their own whenever something can
// address them: an alias names that scope, and an assignment's variable points
// at it. A bare import with no alias has neither, so its contents merge into
// the importing dag instead. That is the same distinction astUtility's
// DeclaredImport carries as `isAssigned`, which is why the flag is the
// parameter here rather than two near-identical functions.
// Returns the nested dag's id for an assignment to bind to, or null when there
// is no id to bind: a merged import, or one that failed to resolve (which has
// already reported itself).
async function processImport(
  importStmt: ImportTreeNode,
  isAssigned: boolean,
  workingDag: Dag,
  ctx: BuildContext,
): Promise<NodeId | null> {
  const importedDag = await getImportedDag(importStmt, workingDag, ctx);
  if (!importedDag) return null;

  if (!isAssigned && !importStmt.ImportName) {
    workingDag.mergeDag(importedDag);
    return null;
  }

  // The dag's id is already the import site's scope path, since that is the
  // scope its contents were built under; an import with no name leaves the dag
  // itself unnamed.
  importedDag.Name = importStmt.ImportName ?? "";
  workingDag.addChildDag(importedDag);
  return importedDag.Id;
}

// Returns null when the right hand side yields no node for the assignment to
// bind to. Every such case has already pushed its own diagnostic, so a null is
// the signal to stop rather than something a caller reports on -- the same
// convention argListToEdgeInfo uses for an argument it could not resolve.
async function processAssignmentRhs(
  rhsNode:
    CallTreeNode | QualifiedVarTreeNode | NamespaceTreeNode | ImportTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): Promise<NodeId | null> {
  return match(rhsNode.Type)
    .with(NodeType.QualifiedVariable, () => {
      const rhsVar = rhsNode as QualifiedVarTreeNode;
      const varName = rhsVar.QualifiedVarName;
      const candidateSrcNodeId = workingDag.getVarNode(varName);
      if (!candidateSrcNodeId) {
        reportError(
          ctx,
          rhsNode,
          `Variable '${varName}' not found`,
          ErrorSource.Reference,
          ErrorCode.VariableNotFound,
        );
        return null;
      }
      return candidateSrcNodeId;
    })
    .with(NodeType.Call, () => {
      return processCall(rhsNode as CallTreeNode, workingDag, ctx);
    })
    .with(NodeType.Namespace, () => {
      return processNamespace(rhsNode as NamespaceTreeNode, workingDag, ctx);
    })
    .with(NodeType.Import, async () => {
      return processImport(rhsNode as ImportTreeNode, true, workingDag, ctx);
    })
    .otherwise(() => {
      reportError(
        ctx,
        rhsNode,
        `Invalid right hand side type '${rhsNode.Type}'`,
        ErrorSource.Internal,
        ErrorCode.InvalidRhsType,
      );
      return null;
    });
}

function checkDuplicateAssignmentLhsNames(
  assignmentStmt: AssignmentTreeNode,
  ctx: BuildContext,
): void {
  const seenNames = new Set<string>();
  assignmentStmt.Lhs.forEach((lhsVar) => {
    if (seenNames.has(lhsVar.VarName)) {
      reportError(
        ctx,
        lhsVar,
        `Duplicate left hand side variable '${lhsVar.VarName}'`,
        ErrorSource.Syntax,
        ErrorCode.DuplicateLhsName,
        "warning",
      );
      return;
    }
    seenNames.add(lhsVar.VarName);
  });
}

async function processAssignment(
  assignmentStmt: AssignmentTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): Promise<void> {
  const lhsIsEmpty = assignmentStmt.Lhs.length === 0;
  if (lhsIsEmpty) {
    reportError(
      ctx,
      assignmentStmt,
      "Left hand side is missing",
      ErrorSource.Syntax,
      ErrorCode.MissingLhs,
    );
  }
  const rhsIsEmpty = !assignmentStmt.Rhs;
  if (rhsIsEmpty) {
    reportError(
      ctx,
      assignmentStmt,
      "Right hand side is missing",
      ErrorSource.Syntax,
      ErrorCode.MissingRhs,
    );
  }
  if (lhsIsEmpty || rhsIsEmpty) return;

  checkDuplicateAssignmentLhsNames(assignmentStmt, ctx);

  const thisNodeId = await processAssignmentRhs(
    assignmentStmt.Rhs,
    workingDag,
    ctx,
  );
  if (!thisNodeId) return;
  for (const lhsVar of assignmentStmt.Lhs) {
    workingDag.setVarNode(lhsVar.VarName, thisNodeId);
    checkStyleTagsInStyleNode(lhsVar.Styling, workingDag, ctx);
    const varStyle = lhsVar.Styling ? makeDagStyle(lhsVar.Styling) : null;
    workingDag.setVarStyle(lhsVar.VarName, varStyle);
  }
}

function processNamedStyle(
  namedStyleStmt: NamedStyleTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): void {
  const styleNode = namedStyleStmt.StyleNode;
  checkStyleTagsInStyleNode(styleNode, workingDag, ctx);
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
  ctx: BuildContext,
): void {
  const styleNode = styleBindingStmt.StyleNode;
  checkStyleTagsInStyleNode(styleNode, workingDag, ctx);
  workingDag.addStyleBinding(styleBindingStmt.Keyword, makeDagStyle(styleNode));
}

function processGlobalStyleBinding(
  globalStyleBindingStmt: GlobalStyleBindingTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): void {
  const keyword = globalStyleBindingStmt.Keyword;
  const canonicalKeyword = GLOBAL_STYLE_KEYWORD_MAP.get(keyword);
  if (!canonicalKeyword) {
    reportError(
      ctx,
      globalStyleBindingStmt,
      `Invalid global style binding keyword '${keyword}'`,
      ErrorSource.Syntax,
      ErrorCode.InvalidGlobalStyleKeyword,
    );
    return;
  }
  const styleNode = globalStyleBindingStmt.StyleNode;
  checkStyleTagsInStyleNode(styleNode, workingDag, ctx);
  workingDag.addGlobalStyleBinding(canonicalKeyword, makeDagStyle(styleNode));
}

function processRendererDirective(
  rendererDirectiveStmt: RendererDirectiveTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): void {
  // Renderer directives configure the drawing surface and layout, which are
  // properties of the whole graph. A renderer instantiates one layout for the
  // root dag, so a directive nested in a namespace could never take effect.
  if (workingDag.Parent) {
    reportError(
      ctx,
      rendererDirectiveStmt,
      `Renderer directive '^${rendererDirectiveStmt.RendererName}' is only ` +
        `allowed at the top level, not inside namespace '${workingDag.Name}'`,
      ErrorSource.Syntax,
      ErrorCode.RendererDirectiveNotAtTopLevel,
    );
    return;
  }
  // The renderer name is deliberately not validated. The compiler has no
  // knowledge of the renderer registry, and a directive addressed to a
  // renderer that is not active is simply never read.
  const styleNode = rendererDirectiveStmt.StyleNode;
  checkStyleTagsInStyleNode(styleNode, workingDag, ctx);
  workingDag.addRendererDirective(
    rendererDirectiveStmt.RendererName,
    makeDagStyle(styleNode),
  );
}

function processAboutNote(
  aboutNoteStmt: AboutNoteTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): void {
  // About notes should describe the recipe file as a whole, so a note nested
  // in a namespace cannot be read from the root dag.
  if (workingDag.Parent) {
    reportError(
      ctx,
      aboutNoteStmt,
      `About note '~${aboutNoteStmt.NoteName}' is only ` +
        `allowed at the top level, not inside namespace '${workingDag.Name}'`,
      ErrorSource.Syntax,
      ErrorCode.AboutNoteNotAtTopLevel,
    );
    return;
  }
  // The note name is deliberately not validated. A note can be treated as a
  // semi-structured comment, so the compiler ascribes no meaning to its name
  // or its keys. We may add validation in the future if the community converges
  // on standard metadata notes.
  const styleNode = aboutNoteStmt.StyleNode;
  checkStyleTagsInStyleNode(styleNode, workingDag, ctx);
  workingDag.addAboutNote(aboutNoteStmt.NoteName, makeDagStyle(styleNode));
}

async function processStatement(
  stmt: BaseTreeNode,
  workingDag: Dag,
  ctx: BuildContext,
): Promise<void> {
  await match(stmt.Type)
    .with(NodeType.Call, () => {
      processCall(stmt as CallTreeNode, workingDag, ctx);
    })
    .with(NodeType.Assignment, async () => {
      await processAssignment(stmt as AssignmentTreeNode, workingDag, ctx);
    })
    .with(NodeType.NamedStyle, () => {
      processNamedStyle(stmt as NamedStyleTreeNode, workingDag, ctx);
    })
    .with(NodeType.StyleBinding, () => {
      processStyleBinding(stmt as StyleBindingTreeNode, workingDag, ctx);
    })
    .with(NodeType.GlobalStyleBinding, () => {
      processGlobalStyleBinding(
        stmt as GlobalStyleBindingTreeNode,
        workingDag,
        ctx,
      );
    })
    .with(NodeType.RendererDirective, () => {
      processRendererDirective(
        stmt as RendererDirectiveTreeNode,
        workingDag,
        ctx,
      );
    })
    .with(NodeType.AboutNote, () => {
      processAboutNote(stmt as AboutNoteTreeNode, workingDag, ctx);
    })
    .with(NodeType.QualifiedVariable, () => null)
    .with(NodeType.Namespace, async () => {
      await processNamespace(stmt as NamespaceTreeNode, workingDag, ctx);
    })
    .with(NodeType.Import, async () => {
      await processImport(stmt as ImportTreeNode, false, workingDag, ctx);
    })
    .otherwise(() => {
      reportError(
        ctx,
        stmt,
        `Unknown statement type '${stmt.Type}'`,
        ErrorSource.Internal,
        ErrorCode.UnknownStatementType,
      );
    });
}

async function makeSubDag(
  dagId: DagId,
  dagNamespaceStmt: NamespaceTreeNode,
  ctx: BuildContext,
  parentDag?: Dag,
): Promise<Dag> {
  checkStyleTagsInStyleNode(dagNamespaceStmt.Styling, parentDag, ctx);
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
    await processStatement(stmt, curLevelDag, ctx);
  }
  return curLevelDag;
}

async function buildDag(
  recipe: RecipeTreeNode,
  ctx: BuildContext,
): Promise<Dag> {
  const statementList = new StatementListTreeNode(
    recipe.Statements,
    recipe.Position,
  );
  return makeSubDag(
    ctx.ids.ScopePath,
    new NamespaceTreeNode("", statementList),
    ctx,
  );
}

// Every compile starts a fresh import chain: nothing imported this recipe.
export async function makeDag(
  recipe: RecipeTreeNode,
  resolveImport: ImportResolver,
  ids: StableIdContext = new StableIdContext("root"),
): Promise<{ dag: Dag; errors: Error[] }> {
  const errors: Error[] = [];
  const dag = await buildDag(recipe, {
    errors,
    resolveImport,
    importChain: new Set(),
    ids,
  });
  return { dag, errors };
}
