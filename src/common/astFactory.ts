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
  VariableTreeNode,
  StyleTreeNode,
  NamedStyleTreeNode,
  StyleBindingTreeNode,
} from "./ast";

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

function getQualifiedIdentifer(c: TreeCursor, s: EditorState): string[] {
  const candidateIdentifierList = c.node.getChild("QualifiableIdentifier");
  if (!candidateIdentifierList) return [];
  return candidateIdentifierList
    .getChildren("Identifier")
    .map((identifier) => s.doc.sliceString(identifier.from, identifier.to));
}

function getLastIdentifier(qualifiedIdentifier: string[]): string {
  // temporarily assume the last identifier as the function name
  return qualifiedIdentifier.length > 0
    ? qualifiedIdentifier[qualifiedIdentifier.length - 1]
    : "";
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

function fillStyleTag(c: TreeCursor, s: EditorState): string {
  const styleQualifiedIdent = getQualifiedIdentifer(c, s);
  const styleTagIdent = getLastIdentifier(styleQualifiedIdent);
  return styleTagIdent;
}

function fillStyle(c: TreeCursor, s: EditorState): StyleTreeNode {
  const styleTags: string[] = c.node
    .getChildren("StyleTag")
    .map((styleTag) => fillStyleTag(styleTag.cursor(), s));
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

function fillNamedStyle(c: TreeCursor, s: EditorState): NamedStyleTreeNode {
  const styleName = getTextFromChild("Identifier", c, s);

  const candidateStyleArgList = c.node.getChild("StyleArgList");
  const styleNode = candidateStyleArgList
    ? fillStyle(candidateStyleArgList.cursor(), s)
    : new StyleTreeNode();

  return new NamedStyleTreeNode(styleName, styleNode);
}

function fillStyleBinding(c: TreeCursor, s: EditorState): StyleBindingTreeNode {
  const keyword = getTextFromChild("Identifier", c, s);

  const candidateTagList = c.node.getChild("StyleTagList");
  const styleTagList: string[] = candidateTagList
    ? candidateTagList
        .getChildren("StyleTag")
        .map((styleTag) => fillStyleTag(styleTag.cursor(), s))
    : [];
  return new StyleBindingTreeNode(keyword, styleTagList);
}

function fillRhsVariable(c: TreeCursor, s: EditorState): VariableTreeNode {
  const varQualifiedIdent = getQualifiedIdentifer(c, s);
  const varName = getLastIdentifier(varQualifiedIdent);
  return new VariableTreeNode(varName);
}

function fillCall(c: TreeCursor, s: EditorState): CallTreeNode {
  const callQualifiedIdent = getQualifiedIdentifer(c, s);
  const functionName = getLastIdentifier(callQualifiedIdent);

  const candidateArgList = c.node.getChild("ArgList");
  const argList: ValueTreeNode[] = candidateArgList
    ? (candidateArgList
        .getChildren("Value")
        .map((candidateValue) =>
          match(candidateValue.name)
            .with("Call", () => fillCall(candidateValue.cursor(), s))
            .with("RhsVariable", () =>
              fillRhsVariable(candidateValue.cursor(), s),
            )
            .otherwise(() => {
              console.error("Unknown value type ", candidateValue.name);
              return null;
            }),
        )
        .filter(Boolean) as ValueTreeNode[])
    : [];

  const candidateStyleArgList = c.node.getChild("StyleArgList");
  const styleNode = candidateStyleArgList
    ? fillStyle(candidateStyleArgList.cursor(), s)
    : null;

  return new CallTreeNode(functionName, argList, styleNode);
}

function fillLhsVariable(c: TreeCursor, s: EditorState): VariableTreeNode {
  const ident = getTextFromChild("Identifier", c, s);

  const candidateStyleArgList = c.node.getChild("StyleArgList");
  const styleNode = candidateStyleArgList
    ? fillStyle(candidateStyleArgList.cursor(), s)
    : null;

  return new VariableTreeNode(ident, styleNode);
}

function fillAssignment(c: TreeCursor, s: EditorState): AssignmentTreeNode {
  const lhsVars = c.node
    .getChildren("LhsVariable")
    .map((candidateLhsVar) => fillLhsVariable(candidateLhsVar.cursor(), s));

  const candidateRhsIdent = c.node.getChild("Call");
  const rhsCall = candidateRhsIdent
    ? fillCall(candidateRhsIdent.cursor(), s)
    : null;

  return new AssignmentTreeNode(lhsVars, rhsCall);
}

function fillAlias(c: TreeCursor, s: EditorState): AliasTreeNode {
  const candidateLhsVar = c.node.getChild("LhsVariable");
  const lhsVar = candidateLhsVar
    ? fillLhsVariable(candidateLhsVar.cursor(), s)
    : null;

  const candidateRhsVar = c.node.getChild("RhsVariable");
  const rhsVar = candidateRhsVar
    ? fillRhsVariable(candidateRhsVar.cursor(), s)
    : null;

  return new AliasTreeNode(lhsVar, rhsVar);
}

function fillStatement(
  c: TreeCursor,
  s: EditorState,
): StatementTreeNode | null {
  return match(c.node.name)
    .with("Call", () => fillCall(c, s))
    .with("Alias", () => fillAlias(c, s))
    .with("Assignment", () => fillAssignment(c, s))
    .with("StyleTagDeclaration", () => fillNamedStyle(c, s))
    .with("StyleBinding", () => fillStyleBinding(c, s))
    .with("⚠", () => null) // Error token for incomplete trees
    .with("Recipe", () => null)
    .with("LineComment", () => null)
    .with("BlockComment", () => null)
    .otherwise(() => {
      console.warn("Unknown node type ", c.node.name);
      return null;
    });
}

/*
Lezer's lightweight design means it doesn't store token values.
https://discuss.codemirror.net/t/example-of-using-lezer-to-generate-a-traditional-ast/2907
We need to fill in the AST values ourselves by looking up syntax tree nodes'
text positions in the document. Though inefficient, reproducing the tree after
every change is the cleanest approach. Memoize / optimize later.
https://discuss.codemirror.net/t/efficient-reuse-of-productions-of-the-parse-tree/2944
*/
export function fillTree(s: EditorState): RecipeTreeNode {
  const editorStateTree = syntaxTree(s);
  const cursor = editorStateTree.cursor();

  if (cursor.name === "") return new RecipeTreeNode();

  if (cursor.name !== "Recipe") console.error("Failed to parse ", cursor.name);

  const stRoot = new RecipeTreeNode();
  cursor.firstChild();
  do {
    const stmtNode: StatementTreeNode | null = fillStatement(cursor, s);
    if (stmtNode) stRoot.addChild(stmtNode);
  } while (cursor.nextSibling());
  return stRoot;
}
