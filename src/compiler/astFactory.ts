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
  AliasTreeNode,
  QualifiedVarTreeNode,
  LocalVarTreeNode,
  StyleTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
  NamespaceTreeNode,
  ImportTreeNode,
  QualifiableIdentifier,
} from "./ast";

function makeNullableChild<Result>(
  childName: string,
  childFactory: (c: TreeCursor, t: Text) => Result,
  c: TreeCursor,
  t: Text,
): Result | null {
  const candidateChild = c.node.getChild(childName);
  return candidateChild ? childFactory(candidateChild.cursor(), t) : null;
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

function getStyleTagNames(c: TreeCursor, t: Text): QualifiableIdentifier[] {
  return c.node
    .getChildren("StyleTag")
    .map((styleTag) => getQualifiableIdentifer(styleTag.cursor(), t));
}

function makeStyle(c: TreeCursor, t: Text): StyleTreeNode {
  const styleTags: QualifiableIdentifier[] = getStyleTagNames(c, t);
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

  return new StyleTreeNode(styleDeclaredPropertyValues, styleTags);
}

function makeNamedStyle(c: TreeCursor, t: Text): NamedStyleTreeNode {
  const styleName = getTextFromChild("Identifier", c, t);

  const styleNode =
    makeNullableChild("StyleArgList", makeStyle, c, t) ?? new StyleTreeNode();

  return new NamedStyleTreeNode(styleName, styleNode);
}

function makeStyleBinding(c: TreeCursor, t: Text): StyleBindingTreeNode {
  const keyword = getTextFromChild("Identifier", c, t);

  const styleTagList: QualifiableIdentifier[] =
    makeNullableChild("StyleTagList", getStyleTagNames, c, t) ?? [];
  return new StyleBindingTreeNode(keyword, styleTagList);
}

function makeRhsVariable(c: TreeCursor, t: Text): QualifiedVarTreeNode {
  const varQualifiedIdent = getQualifiableIdentifer(c, t);
  return new QualifiedVarTreeNode(varQualifiedIdent);
}

function getArgList(c: TreeCursor, t: Text): ValueTreeNode[] {
  return c.node
    .getChildren("Value")
    .map((candidateValue) =>
      match(candidateValue.name)
        .with("Call", () => makeCall(candidateValue.cursor(), t))
        .with("RhsVariable", () => makeRhsVariable(candidateValue.cursor(), t))
        .otherwise(() => {
          console.error("Unknown value type ", candidateValue.name);
          return null;
        }),
    )
    .filter(Boolean) as ValueTreeNode[];
}

function makeCall(c: TreeCursor, t: Text): CallTreeNode {
  const functionName = getTextFromChild("Identifier", c, t);

  const argList = makeNullableChild("ArgList", getArgList, c, t) ?? [];

  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, t);

  return new CallTreeNode(functionName, argList, styleNode);
}

function makeLhsVariable(c: TreeCursor, t: Text): LocalVarTreeNode {
  const ident = getTextFromChild("Identifier", c, t);

  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, t);

  return new LocalVarTreeNode(ident, styleNode);
}

function makeAssignment(c: TreeCursor, t: Text): AssignmentTreeNode {
  const lhsVars = c.node
    .getChildren("LhsVariable")
    .map((candidateLhsVar) => makeLhsVariable(candidateLhsVar.cursor(), t));

  const rhsCall = makeNullableChild("Call", makeCall, c, t);
  if (rhsCall) return new AssignmentTreeNode(lhsVars, rhsCall);

  const rhsNs = makeNullableChild("Namespace", makeNamespace, c, t);
  if (rhsNs) return new AssignmentTreeNode(lhsVars, rhsNs);

  const rhsImport = makeNullableChild("Import", makeImport, c, t);
  if (rhsImport) return new AssignmentTreeNode(lhsVars, rhsImport);

  return new AssignmentTreeNode(lhsVars, null);
}

function makeAlias(c: TreeCursor, t: Text): AliasTreeNode {
  const lhsVar = makeNullableChild("LhsVariable", makeLhsVariable, c, t);

  const rhsVar = makeNullableChild("RhsVariable", makeRhsVariable, c, t);

  return new AliasTreeNode(lhsVar, rhsVar);
}

function makeImport(c: TreeCursor, t: Text): ImportTreeNode {
  const importLocation = getJoinedStringLiterals(c, t) ?? "";
  const importAs = getTextFromChild("Identifier", c, t);
  return new ImportTreeNode(importLocation, importAs);
}

function getStatements(c: TreeCursor, t: Text): StatementTreeNode[] {
  return c.node
    .getChildren("Statement")
    .map((stmtNode) => makeStatement(stmtNode.cursor(), t))
    .filter(Boolean) as StatementTreeNode[];
}

function makeNamespace(c: TreeCursor, t: Text): NamespaceTreeNode {
  const namespaceName = getTextFromChild("Identifier", c, t);

  const namespaceStatements =
    makeNullableChild("StatementList", getStatements, c, t) ?? [];

  const argList = makeNullableChild("ArgList", getArgList, c, t) ?? [];

  const styleNode = makeNullableChild("StyleArgList", makeStyle, c, t);

  return new NamespaceTreeNode(
    namespaceName,
    namespaceStatements,
    argList,
    styleNode,
  );
}

function makeStatement(c: TreeCursor, t: Text): StatementTreeNode | null {
  return match(c.node.name)
    .with("Call", () => makeCall(c, t))
    .with("RhsVariable", () => makeRhsVariable(c, t))
    .with("Alias", () => makeAlias(c, t))
    .with("Assignment", () => makeAssignment(c, t))
    .with("StyleTagDeclaration", () => makeNamedStyle(c, t))
    .with("StyleBinding", () => makeStyleBinding(c, t))
    .with("Namespace", () => makeNamespace(c, t))
    .with("Import", () => makeImport(c, t))
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
export function makeRecipeTree(tree: Tree, text: Text): RecipeTreeNode {
  const cursor = tree.cursor();

  if (cursor.name === "") return new RecipeTreeNode();

  if (cursor.name !== "Recipe") console.error("Failed to parse ", cursor.name);

  const statements = getStatements(cursor, text);
  return new RecipeTreeNode(statements);
}
