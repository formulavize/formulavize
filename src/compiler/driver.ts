import { EditorState } from "@codemirror/state";
import { makeDag } from "./dagFactory";
import { Compilation } from "./compilation";
import { ParseResult, parseFromEditorState, parseFromSource } from "./parser";
import { ImportCacher, ImportResolver } from "./importCacher";
import { FetchSourceFn } from "./importFetcher";

export interface CompilerOptions {
  // How imports are read. Defaults to fetching over HTTP; the CLI passes a
  // filesystem-backed fetcher so relative imports resolve outside a browser.
  fetchSource?: FetchSourceFn;
}

export class Compiler {
  private importCacher: ImportCacher;

  constructor(options: CompilerOptions = {}) {
    this.importCacher = new ImportCacher(options.fetchSource);
  }

  get ImportCacher(): ImportCacher {
    return this.importCacher;
  }

  compileFromEditor(editorState: EditorState): Promise<Compilation> {
    return this.compileParsed(
      editorState.doc.toString(),
      parseFromEditorState(editorState),
    );
  }

  compileFromSource(sourceRecipe: string): Promise<Compilation> {
    return this.compileParsed(sourceRecipe, parseFromSource(sourceRecipe));
  }

  // Every compile starts a fresh import chain: nothing imported this recipe.
  // A nested import's chain comes from the resolver its parent was handed, so
  // there is no recursive entry point here to thread one through.
  private async compileParsed(
    source: string,
    parsed: ParseResult,
  ): Promise<Compilation> {
    const { dag, errors: dagErrors } = await makeDag(
      parsed.ast,
      new ImportResolver(this.importCacher),
    );
    return new Compilation(source, parsed.ast, dag, [
      ...parsed.errors,
      ...dagErrors,
    ]);
  }
}
