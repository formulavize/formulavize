import { shallowRef, watch } from "vue";
import { EditorState, Text } from "@codemirror/state";
import { Diagnostic } from "@codemirror/lint";
import { cloneDeep } from "lodash";
import { RecipeTreeNode } from "../compiler/ast";
import { Dag } from "../compiler/dag";
import { Compiler } from "../compiler/driver";
import { CompilationError, ErrorSource } from "../compiler/compilationErrors";
import { errorToDiagnostic, ErrorReporter } from "../compiler/errorReporter";
import { CompletionIndex } from "../autocomplete/autocompletion";
import { createCompletionIndex } from "../autocomplete/autocompletionFactory";
import { dumpImportTree } from "../compiler/importUtility";
import { Compilation } from "../compiler/compilation";

export function useCompilation(
  shouldDumpImports: () => boolean,
  onCompilationComplete?: (compilation: Compilation) => void,
) {
  const compiler = new Compiler();
  const curEditorState = shallowRef(EditorState.create());
  const curAst = shallowRef(new RecipeTreeNode());
  const curDag = shallowRef(new Dag(""));
  const curErrors = shallowRef<CompilationError[]>([]);
  const curDiagnostics = shallowRef<Diagnostic[]>([]);
  const curErrorReporter = shallowRef(new ErrorReporter(Text.empty));
  const curCompletionIndex = shallowRef(new CompletionIndex());
  const curImportDump = shallowRef("(no imports)");

  watch(curEditorState, async (newEditorState: EditorState) => {
    try {
      const curCompilation = await compiler.compileFromEditor(newEditorState);
      curAst.value = curCompilation.AST;
      curDag.value = curCompilation.DAG;
      curErrors.value = curCompilation.Errors;
      curDiagnostics.value = curCompilation.Errors.map(errorToDiagnostic);
      curErrorReporter.value = new ErrorReporter(newEditorState.doc);
      curCompletionIndex.value = await createCompletionIndex(
        curCompilation.AST,
        (path) =>
          compiler.ImportCacher.getCachedCompilation(path)
            .then((c) => c?.AST)
            .catch(() => undefined),
      );
      if (shouldDumpImports()) {
        curImportDump.value = await dumpImportTree(
          compiler.ImportCacher,
          curCompilation.AST,
        );
      }
      onCompilationComplete?.(curCompilation);
    } catch (err) {
      console.error("Unexpected compilation error:", err);
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      curErrors.value = [
        {
          position: { from: 0, to: 0 },
          message: `Internal error: ${message}`,
          severity: "error",
          source: ErrorSource.Internal,
        },
      ];
      curDiagnostics.value = curErrors.value.map(errorToDiagnostic);
    }
  });

  function updateEditorState(editorState: EditorState) {
    curEditorState.value = editorState;
  }

  function repaint() {
    const existingEditorState = cloneDeep(curEditorState.value);
    updateEditorState(existingEditorState as EditorState);
  }

  function copySourceToClipboard() {
    const sourceText = curEditorState.value.doc.toString();
    return navigator.clipboard.writeText(sourceText).catch((err) => {
      console.error("Failed to copy to clipboard:", err);
    });
  }

  return {
    compiler,
    curEditorState,
    curAst,
    curDag,
    curErrors,
    curDiagnostics,
    curErrorReporter,
    curCompletionIndex,
    curImportDump,
    updateEditorState,
    repaint,
    copySourceToClipboard,
  };
}
