import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { fizLanguage } from "@formulavize/lang-fiz";
import { RecipeTreeNode } from "./ast";
import { makeRecipeTree } from "./astFactory";
import { CompilationError } from "./compilationErrors";

// Source text to AST. Two entry points because the editor already holds an
// incrementally parsed tree, while every other caller (an import, the CLI, a
// test) has only a string and must parse it from scratch. Both are pure, which
// is what lets importCacher memoize a recipe's parse without reaching back
// into the Compiler.

export interface ParseResult {
  ast: RecipeTreeNode;
  errors: CompilationError[];
}

export function parseFromSource(sourceRecipe: string): ParseResult {
  const tree = fizLanguage.parser.parse(sourceRecipe);
  const editorState = EditorState.create({ extensions: [fizLanguage] });
  const text = editorState.toText(sourceRecipe);
  return makeRecipeTree(tree, text);
}

export function parseFromEditorState(editorState: EditorState): ParseResult {
  const tree = syntaxTree(editorState);
  const text = editorState.doc;
  return makeRecipeTree(tree, text);
}
