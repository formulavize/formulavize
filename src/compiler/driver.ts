import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { fizLanguage } from "@formulavize/lang-fiz";
import { RecipeTreeNode } from "./ast";
import { makeRecipeTree } from "./astFactory";
import { makeDag } from "./dagFactory";
import { Compilation } from "./compilation";
import { ImportCacher } from "./importCacher";
import { CompilationError as Error } from "./compilationErrors";

interface SourceGen<I> {
  (input: I): string;
}

interface Parse<I> {
  (input: I): { ast: RecipeTreeNode; errors: Error[] };
}

export function parseFromSource(sourceRecipe: string): {
  ast: RecipeTreeNode;
  errors: Error[];
} {
  const tree = fizLanguage.parser.parse(sourceRecipe);
  const editorState = EditorState.create({ extensions: [fizLanguage] });
  const text = editorState.toText(sourceRecipe);
  return makeRecipeTree(tree, text);
}

export class Compiler {
  private importCacher: ImportCacher;

  constructor() {
    this.importCacher = new ImportCacher(this);
  }

  get ImportCacher(): ImportCacher {
    return this.importCacher;
  }

  async compile<I>(
    input: I,
    sourceGen: SourceGen<I>,
    parse: Parse<I>,
    seenImports: Set<string> = new Set(),
  ): Promise<Compilation> {
    const source = sourceGen(input);
    const { ast } = parse(input);
    const { dag } = await makeDag(ast, this.importCacher, seenImports);
    return new Compilation(source, ast, dag);
  }

  compileFromEditor(editorState: EditorState): Promise<Compilation> {
    function sourceFromEditor(editorState: EditorState): string {
      return editorState.doc.toString();
    }

    function parseFromEditor(editorState: EditorState): {
      ast: RecipeTreeNode;
      errors: Error[];
    } {
      const tree = syntaxTree(editorState);
      const text = editorState.doc;
      return makeRecipeTree(tree, text);
    }

    return this.compile(editorState, sourceFromEditor, parseFromEditor);
  }

  compileFromSource(
    sourceRecipe: string,
    seenImports: Set<string> = new Set(),
  ): Promise<Compilation> {
    function sourceFromSource(sourceRecipe: string): string {
      return sourceRecipe;
    }

    return this.compile(
      sourceRecipe,
      sourceFromSource,
      parseFromSource,
      seenImports,
    );
  }
}
