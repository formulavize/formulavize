import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { fizLanguage } from "@formulavize/lang-fiz";
import { RecipeTreeNode } from "./ast";
import { makeRecipeTree } from "./astFactory";
import { makeDag } from "./dagFactory";
import { Compilation } from "./compilation";
import { ImportCacher } from "./importCacher";

// Define the compiler driver interfaces for extensibility
// May swap out with other parser libraries in the future

interface SourceGen<I> {
  (input: I): string;
}

interface Parse<I> {
  (input: I): RecipeTreeNode;
}

export namespace Compiler {
  export class Driver {
    private importCacher: ImportCacher;

    constructor() {
      this.importCacher = new ImportCacher(this);
    }

    async compile<I>(
      input: I,
      sourceGen: SourceGen<I>,
      parse: Parse<I>,
    ): Promise<Compilation> {
      const source = sourceGen(input);
      const ast = parse(input);
      const dag = await makeDag(ast, this.importCacher);
      return new Compilation(source, ast, dag);
    }
  }

  export function sourceFromEditor(editorState: EditorState): string {
    return editorState.doc.toString();
  }

  export function sourceFromSource(sourceRecipe: string): string {
    return sourceRecipe;
  }

  export function parseFromEditor(editorState: EditorState): RecipeTreeNode {
    const tree = syntaxTree(editorState);
    const text = editorState.doc;
    return makeRecipeTree(tree, text);
  }

  export function parseFromSource(sourceRecipe: string): RecipeTreeNode {
    const tree = fizLanguage.parser.parse(sourceRecipe);
    const editorState = EditorState.create({ extensions: [fizLanguage] });
    const text = editorState.toText(sourceRecipe);
    return makeRecipeTree(tree, text);
  }
}
