import { EditorState } from "@codemirror/state";
import { fizLanguage } from "@formulavize/lang-fiz";
import { RecipeTreeNode } from "./ast";
import { makeRecipeTree } from "./editorToAst";
import { makeDag } from "./astToDag";
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

    compile<I>(
      input: I,
      sourceGen: SourceGen<I>,
      parse: Parse<I>,
    ): Compilation {
      const source = sourceGen(input);
      const ast = parse(input);
      const dag = makeDag(ast, this.importCacher);
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
    return makeRecipeTree(editorState);
  }

  export function parseFromSource(sourceRecipe: string): RecipeTreeNode {
    const editorState = EditorState.create({
      doc: sourceRecipe,
      extensions: [fizLanguage],
    });
    return parseFromEditor(editorState);
  }
}
