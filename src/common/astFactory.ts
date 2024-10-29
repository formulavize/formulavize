import { match } from "ts-pattern";
import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { DESCRIPTION_PROPERTY } from "./constants";
import { TreeCursor } from "@lezer/common";
import {
  RecipeTreeNode,
  StatementTreeNode,
  ValueTreeNode,
  CallTreeNode,
  AssignmentTreeNode,
  AliasTreeNode,
  QualifiedVarTreeNode,
  LocalVarTreeNode,
  StyleTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
  NamespaceTreeNode,
  QualifiableIdentifier,
} from "./ast";

function makeNullableChild<Result>(
  childName: string,
  childFactory: (c: TreeCursor, s: EditorState) => Result,
  c: TreeCursor,
  s: EditorState,
): Result | null {
  const candidateChild = c.node.getChild(childName);
  return candidateChild ? childFactory(candidateChild.cursor(), s) : null;
}

function getTextFromChild(
  childName: string,
  c: TreeCursor,
  s: EditorState,
): string {
  // Get the child node with the given name from the cursor
  // and retrieve the text from the EditorState using the syntax node's positions.
  // If the child is not found, return an empty string
  const candidateChild = c.node.getChild(childName);
  return candidateChild
    ? s.doc.sliceString(candidateChild.from, candidateChild.to)
    : "";
}

function getQualifiableIdentifer(c: TreeCursor, s: EditorState): string[] {
  const candidateIdentifierList = c.node.getChild("QualifiableIdentifier");
  if (!candidateIdentifierList) return [];
  return candidateIdentifierList
    .getChildren("Identifier")
    .map((identifier) => s.doc.sliceString(identifier.from, identifier.to));
}

function getDescription(c: TreeCursor, s: EditorState): string | null {
  // Get all child StringLiterals with quotes trimmed
  // from the start and end then join them with newlines
  const descriptionLines: string[] = c.node
    .getChildren("StringLiteral")
    .map((stringLiteral) =>
      stringLiteral
        ? s.doc.sliceString(stringLiteral.from + 1, stringLiteral.to - 1)
        : "",
    );
  return descriptionLines.length > 0 ? descriptionLines.join("\n") : null;
}

function getStyleTagNames(
  c: TreeCursor,
  s: EditorState,
): QualifiableIdentifier[] {
  return c.node
    .getChildren("StyleTag")
    .map((styleTag) => getQualifiableIdentifer(styleTag.cursor(), s));
}

function makeStyle(c: TreeCursor, s: EditorState): StyleTreeNode {
  const styleTags: QualifiableIdentifier[] = getStyleTagNames(c, s);
  const styleDeclaredPropertyValues = new Map<string, string>(
    c.node.getChildren("StyleDeclaration").map((styleDec) => {
      const propName = getTextFromChild("PropertyName", styleDec.cursor(), s);
      const styleVals = styleDec
        .getChildren("StyleValue")
        .map((styleVal) => s.doc.sliceString(styleVal.from, styleVal.to))
        .join(",") // comma delimit multiple values
        .replace(/(^"|^'|"$|'$)/g, "") // remove captured bounding quotes
        .replace(/\\n/g, "\n"); // for enabling cytoscape text-wrap
      return [propName, styleVals];
    }),
  );

  // If there are description strings, store them in a description property
  const description = getDescription(c, s);
  if (description)
    styleDeclaredPropertyValues.set(DESCRIPTION_PROPERTY, description);

  return new StyleTreeNode(styleDeclaredPropertyValues, styleTags);
}

function makeNamedStyle(c: TreeCursor, s: EditorState): NamedStyleTreeNode {
  const styleName = getTextFromChild("Identifier", c, s);

  const styleNode =
    makeNullableChild("StyleArgList", makeStyle, c, s) ?? new StyleTreeNode();

  return new NamedStyleTreeNode(styleName, styleNode);
}

function makeStyleBinding(c: TreeCursor, s: EditorState): StyleBindingTreeNode {
  const keyword = getTextFromChild("Identifier", c, s);

  const styleTagList: QualifiableIdentifier[] =
    makeNullableChild("StyleTagList", getStyleTagNames, c, s) ?? [];
  return new StyleBindingTreeNode(keyword, styleTagList);
}

function makeRhsVariable(c: TreeCursor, s: EditorState): QualifiedVarTreeNode {
  const varQualifiedIdent = getQualifiableIdentifer(c, s);
  return new QualifiedVarTreeNode(varQualifiedIdent);
}

function getArgList(c: TreeCursor, s: EditorState): ValueTreeNode[] {
  return c.node
    .getChildren("Value")
    .map((candidateValue) =>
      match(candidateValue.name)
        .with("Call", () => makeCall(candidateValue.cursor(), s))
        .with("RhsVariable", () => makeRhsVariable(candidateValue.cursor(), s))
        .otherwise(() => {
          console.error("Unknown value type ", candidateValue.name);
          return null;
        }),
    )
    .filter(Boolean) as ValueTreeNode[];
}

function makeCall(c: TreeCursor, s: EditorState): CallTreeNode {
  const functionName = getTextFromChild("Identifier", c, s);

  const argList = makeNullableChild("ArgList", getArgList, c, s) ?? [];

  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, s);

  return new CallTreeNode(functionName, argList, styleNode);
}

function makeLhsVariable(c: TreeCursor, s: EditorState): LocalVarTreeNode {
  const ident = getTextFromChild("Identifier", c, s);

  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, s);

  return new LocalVarTreeNode(ident, styleNode);
}

function makeAssignment(c: TreeCursor, s: EditorState): AssignmentTreeNode {
  const lhsVars = c.node
    .getChildren("LhsVariable")
    .map((candidateLhsVar) => makeLhsVariable(candidateLhsVar.cursor(), s));

  const rhsCall = makeNullableChild("Call", makeCall, c, s);

  return new AssignmentTreeNode(lhsVars, rhsCall);
}

function makeAlias(c: TreeCursor, s: EditorState): AliasTreeNode {
  const lhsVar = makeNullableChild("LhsVariable", makeLhsVariable, c, s);

  const rhsVar = makeNullableChild("RhsVariable", makeRhsVariable, c, s);

  return new AliasTreeNode(lhsVar, rhsVar);
}

function getStatements(c: TreeCursor, s: EditorState): StatementTreeNode[] {
  return c.node
    .getChildren("Statement")
    .map((stmtNode) => makeStatement(stmtNode.cursor(), s))
    .filter(Boolean) as StatementTreeNode[];
}

function makeNamespace(c: TreeCursor, s: EditorState): NamespaceTreeNode {
  const namespaceName = getTextFromChild("Identifier", c, s);

  const namespaceStatements =
    makeNullableChild("StatementList", getStatements, c, s) ?? [];

  const argList = makeNullableChild("ArgList", getArgList, c, s) ?? [];

  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, s);

  return new NamespaceTreeNode(
    namespaceName,
    namespaceStatements,
    argList,
    styleNode,
  );
}

function makeStatement(
  c: TreeCursor,
  s: EditorState,
): StatementTreeNode | null {
  return match(c.node.name)
    .with("Call", () => makeCall(c, s))
    .with("RhsVariable", () => makeRhsVariable(c, s))
    .with("Alias", () => makeAlias(c, s))
    .with("Assignment", () => makeAssignment(c, s))
    .with("StyleTagDeclaration", () => makeNamedStyle(c, s))
    .with("StyleBinding", () => makeStyleBinding(c, s))
    .with("Namespace", () => makeNamespace(c, s))
    .with("⚠", () => null) // Error token for incomplete trees
    .with("Recipe", () => null)
    .with("LineComment", () => null)
    .with("BlockComment", () => null)
    .otherwise(() => {
      console.error("Unknown node type ", c.node.name);
      return null;
    });
}

// Lezer's lightweight design means it doesn't store token values.
// https://discuss.codemirror.net/t/example-of-using-lezer-to-generate-a-traditional-ast/2907
// We need to fill in the AST values ourselves by looking up syntax tree nodes'
// text positions in the document. Though inefficient, reproducing the tree after
// every change is the cleanest approach. Memoize / optimize later.
// https://discuss.codemirror.net/t/efficient-reuse-of-productions-of-the-parse-tree/2944
export function makeRecipeTree(s: EditorState): RecipeTreeNode {
  const editorStateTree = syntaxTree(s);
  const cursor = editorStateTree.cursor();

  if (cursor.name === "") return new RecipeTreeNode();

  if (cursor.name !== "Recipe") console.error("Failed to parse ", cursor.name);

  const statements = getStatements(cursor, s);
  return new RecipeTreeNode(statements);
}
