import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { fizLanguage } from "@formulavize/lang-fiz";
import { RecipeTreeNode } from "./ast";
import { makeRecipeTree } from "./astFactory";
import { makeDag } from "./dagFactory";
import { Compilation } from "./compilation";
import { Dag } from "./dag";
import { ImportCacher } from "./importCacher";
import { CompilationError as Error, ErrorSource } from "./compilationErrors";
import { collectBracketMismatchErrors } from "./sourceScans";

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
  const bracketErrors = collectBracketMismatchErrors(sourceRecipe);
  const { ast, errors: parseErrors } = makeRecipeTree(tree, text);
  return { ast, errors: [...bracketErrors, ...parseErrors] };
}

export class Compiler {
  private importCacher: ImportCacher;

  constructor() {
    this.importCacher = new ImportCacher((source, seenImports) =>
      this.compileFromSource(source, seenImports),
    );
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
    const { ast, errors: parseErrors } = parse(input);

    let dag: Dag;
    let dagErrors: Error[] = [];
    const hasSyntaxErrors = parseErrors.some(
      (error) => error.source === ErrorSource.Syntax,
    );
    if (hasSyntaxErrors) {
      dag = new Dag("root");
    } else {
      const dagResult = await makeDag(ast, this.importCacher, seenImports);
      dag = dagResult.dag;
      dagErrors = dagResult.errors;
    }

    const errors = [...parseErrors, ...dagErrors];
    return new Compilation(source, ast, dag, errors);
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
      const bracketErrors = collectBracketMismatchErrors(
        editorState.doc.toString(),
      );
      const { ast, errors: parseErrors } = makeRecipeTree(tree, text);
      return { ast, errors: [...bracketErrors, ...parseErrors] };
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
