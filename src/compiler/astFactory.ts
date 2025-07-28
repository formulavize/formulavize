import { match } from "ts-pattern";
import { Text } from "@codemirror/state";
import { DESCRIPTION_PROPERTY } from "./constants";
import { Tree, TreeCursor } from "@lezer/common";
import {
  RecipeTreeNode,
  StatementTreeNode,
  ValueTreeNode,
  CallTreeNode,
  AssignmentTreeNode,
  QualifiedVarTreeNode,
  LocalVarTreeNode,
  StyleTreeNode,
  StyleTagTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
  NamespaceTreeNode,
  ImportTreeNode,
} from "./ast";
import {
  CompilationError as Error,
  Position,
  DEFAULT_POSITION,
} from "./compilationErrors";

function getPosition(c: TreeCursor): Position {
  return { from: c.from, to: c.to };
}

function makeInternalError(c: TreeCursor, errorMsg: string): Error {
  return {
    position: getPosition(c),
    message: errorMsg,
    severity: "error",
    source: "Internal",
  };
}

function makeNullableChild<Result>(
  childName: string,
  childFactory: (c: TreeCursor, t: Text, e: Error[]) => Result,
  c: TreeCursor,
  t: Text,
  e: Error[],
): Result | null {
  const candidateChild = c.node.getChild(childName);
  return candidateChild ? childFactory(candidateChild.cursor(), t, e) : null;
}

function getTextFromChild(childName: string, c: TreeCursor, t: Text): string {
  // Get the child node with the given name from the cursor
  // and retrieve the text from the EditorState using the syntax node's positions.
  // If the child is not found, return an empty string
  const candidateChild = c.node.getChild(childName);
  return candidateChild
    ? t.sliceString(candidateChild.from, candidateChild.to)
    : "";
}

function getQualifiableIdentifer(c: TreeCursor, t: Text): string[] {
  const candidateIdentifierList = c.node.getChild("QualifiableIdentifier");
  if (!candidateIdentifierList) return [];
  return candidateIdentifierList
    .getChildren("Identifier")
    .map((identifier) => t.sliceString(identifier.from, identifier.to));
}

function getJoinedStringLiterals(c: TreeCursor, t: Text): string | null {
  // Get all child StringLiterals with quotes trimmed
  // from the start and end then join them with newlines
  const descriptionLines: string[] = c.node
    .getChildren("StringLiteral")
    .map((stringLiteral) =>
      stringLiteral
        ? t.sliceString(stringLiteral.from + 1, stringLiteral.to - 1)
        : "",
    );
  return descriptionLines.length > 0 ? descriptionLines.join("\n") : null;
}

function getStyleTagNames(c: TreeCursor, t: Text): StyleTagTreeNode[] {
  return c.node
    .getChildren("StyleTag")
    .map(
      (styleTag) =>
        new StyleTagTreeNode(
          getQualifiableIdentifer(styleTag.cursor(), t),
          getPosition(styleTag.cursor()),
        ),
    );
}

function makeStyle(c: TreeCursor, t: Text, _e: Error[]): StyleTreeNode {
  const styleTags: StyleTagTreeNode[] = getStyleTagNames(c, t);
  const styleDeclaredPropertyValues = new Map<string, string>(
    c.node.getChildren("StyleDeclaration").map((styleDec) => {
      const propName = getTextFromChild("PropertyName", styleDec.cursor(), t);
      const styleVals = styleDec
        .getChildren("StyleValue")
        .map((styleVal) => t.sliceString(styleVal.from, styleVal.to))
        .join(",") // comma delimit multiple values
        .replace(/(^"|^'|"$|'$)/g, "") // remove captured bounding quotes
        .replace(/\\n/g, "\n"); // for enabling cytoscape text-wrap
      return [propName, styleVals];
    }),
  );

  // If there are description strings, store them in a description property
  const description = getJoinedStringLiterals(c, t);
  if (description)
    styleDeclaredPropertyValues.set(DESCRIPTION_PROPERTY, description);

  return new StyleTreeNode(
    styleDeclaredPropertyValues,
    styleTags,
    getPosition(c),
  );
}

function makeNamedStyle(
  c: TreeCursor,
  t: Text,
  e: Error[],
): NamedStyleTreeNode {
  const styleName = getTextFromChild("Identifier", c, t);
  const styleNode =
    makeNullableChild("StyleArgList", makeStyle, c, t, e) ??
    new StyleTreeNode(new Map(), [], getPosition(c));
  return new NamedStyleTreeNode(styleName, styleNode, getPosition(c));
}

function makeStyleBinding(
  c: TreeCursor,
  t: Text,
  e: Error[],
): StyleBindingTreeNode {
  const keyword = getTextFromChild("Identifier", c, t);
  const styleTagList: StyleTagTreeNode[] =
    makeNullableChild("StyleTagList", getStyleTagNames, c, t, e) ?? [];
  return new StyleBindingTreeNode(keyword, styleTagList, getPosition(c));
}

function makeRhsVariable(c: TreeCursor, t: Text): QualifiedVarTreeNode {
  const varQualifiedIdent = getQualifiableIdentifer(c, t);
  return new QualifiedVarTreeNode(varQualifiedIdent, getPosition(c));
}

function getArgList(c: TreeCursor, t: Text, e: Error[]): ValueTreeNode[] {
  return c.node
    .getChildren("Value")
    .map((candidateValue) =>
      match(candidateValue.name)
        .with("Call", () => makeCall(candidateValue.cursor(), t, e))
        .with("RhsVariable", () => makeRhsVariable(candidateValue.cursor(), t))
        .otherwise(() => {
          const errMsg = makeInternalError(
            candidateValue.cursor(),
            `Unknown argument type '${candidateValue.name}'`,
          );
          e.push(errMsg);
          console.error(errMsg);
          return null;
        }),
    )
    .filter(Boolean) as ValueTreeNode[];
}

function makeCall(c: TreeCursor, t: Text, e: Error[]): CallTreeNode {
  const functionName = getTextFromChild("Identifier", c, t);
  const argList = makeNullableChild("ArgList", getArgList, c, t, e) ?? [];
  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, t, e);
  return new CallTreeNode(functionName, argList, styleNode, getPosition(c));
}

function makeLhsVariable(c: TreeCursor, t: Text, e: Error[]): LocalVarTreeNode {
  const ident = getTextFromChild("Identifier", c, t);
  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, t, e);
  return new LocalVarTreeNode(ident, styleNode, getPosition(c));
}

function makeAssignment(
  c: TreeCursor,
  t: Text,
  e: Error[],
): AssignmentTreeNode {
  const lhsVars = c.node
    .getChildren("LhsVariable")
    .map((candidateLhsVar) => makeLhsVariable(candidateLhsVar.cursor(), t, e));

  const rhsNode =
    c.node.getChild("RhsVariable") ??
    c.node.getChild("Call") ??
    c.node.getChild("Namespace") ??
    c.node.getChild("Import");

  const rhs = match(rhsNode?.name)
    .with("RhsVariable", () => makeRhsVariable(rhsNode!.cursor(), t))
    .with("Call", () => makeCall(rhsNode!.cursor(), t, e))
    .with("Namespace", () => makeNamespace(rhsNode!.cursor(), t, e))
    .with("Import", () => makeImport(rhsNode!.cursor(), t))
    .otherwise(() => null);

  return new AssignmentTreeNode(lhsVars, rhs, getPosition(c));
}

function makeImport(c: TreeCursor, t: Text): ImportTreeNode {
  const importLocation = getJoinedStringLiterals(c, t) ?? "";
  const importAs = getTextFromChild("Identifier", c, t);
  return new ImportTreeNode(importLocation, importAs, getPosition(c));
}

function getStatements(
  c: TreeCursor,
  t: Text,
  e: Error[],
): StatementTreeNode[] {
  return c.node
    .getChildren("Statement")
    .map((stmtNode) => makeStatement(stmtNode.cursor(), t, e))
    .filter(Boolean) as StatementTreeNode[];
}

function makeNamespace(c: TreeCursor, t: Text, e: Error[]): NamespaceTreeNode {
  const namespaceName = getTextFromChild("Identifier", c, t);

  const namespaceStatements =
    makeNullableChild("StatementList", getStatements, c, t, e) ?? [];

  const argList = makeNullableChild("ArgList", getArgList, c, t, e) ?? [];

  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, t, e);

  return new NamespaceTreeNode(
    namespaceName,
    namespaceStatements,
    argList,
    styleNode,
    getPosition(c),
  );
}

function makeStatement(
  c: TreeCursor,
  t: Text,
  e: Error[],
): StatementTreeNode | null {
  return match(c.node.name)
    .with("Call", () => makeCall(c, t, e))
    .with("RhsVariable", () => makeRhsVariable(c, t))
    .with("Assignment", () => makeAssignment(c, t, e))
    .with("StyleTagDeclaration", () => makeNamedStyle(c, t, e))
    .with("StyleBinding", () => makeStyleBinding(c, t, e))
    .with("Namespace", () => makeNamespace(c, t, e))
    .with("Import", () => makeImport(c, t))
    .with("⚠", () => null) // Error token for incomplete trees
    .with("Recipe", () => null)
    .with("LineComment", () => null)
    .with("BlockComment", () => null)
    .otherwise(() => {
      const errMsg = makeInternalError(
        c,
        `Unknown statement type '${c.node.name}'`,
      );
      e.push(errMsg);
      console.error(errMsg);
      return null;
    });
}

// Lezer's lightweight design means it doesn't store token values.
// https://discuss.codemirror.net/t/example-of-using-lezer-to-generate-a-traditional-ast/2907
// We need to fill in the AST values ourselves by looking up syntax tree nodes'
// text positions in the document. Though inefficient, reproducing the tree after
// every change is the cleanest approach. Memoize / optimize later.
// https://discuss.codemirror.net/t/efficient-reuse-of-productions-of-the-parse-tree/2944
export function makeRecipeTree(
  tree: Tree,
  text: Text,
): { ast: RecipeTreeNode; errors: Error[] } {
  const cursor = tree.cursor();
  const errors: Error[] = [];

  if (cursor.name === "")
    return { ast: new RecipeTreeNode([], DEFAULT_POSITION), errors };

  if (cursor.name !== "Recipe") {
    const errMsg = makeInternalError(
      cursor,
      `Expected Recipe node but received '${cursor.name}' instead`,
    );
    errors.push(errMsg);
    console.error(errMsg);
  }

  const statements = getStatements(cursor, text, errors);
  const ast = new RecipeTreeNode(statements, getPosition(cursor));
  return { ast, errors };
}
