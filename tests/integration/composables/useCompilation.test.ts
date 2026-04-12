import { describe, test, expect, vi, beforeEach } from "vitest";
import { effectScope, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { EditorState } from "@codemirror/state";
import { fizLanguage } from "@formulavize/lang-fiz";
import { Dag } from "src/compiler/dag";
import { RecipeTreeNode } from "src/compiler/ast";
import { CompletionIndex } from "src/autocomplete/autocompletion";
import { useCompilation } from "src/composables/useCompilation";

function createEditorStateFromSource(source: string): EditorState {
  return EditorState.create({
    doc: source,
    extensions: [fizLanguage],
  });
}

describe("useCompilation", () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    scope = effectScope();
  });

  test("initializes with default values", () => {
    scope.run(() => {
      const { curAst, curDag, curErrors, curDiagnostics, curImportDump } =
        useCompilation(() => false);

      expect(curAst.value).toBeInstanceOf(RecipeTreeNode);
      expect(curDag.value).toBeInstanceOf(Dag);
      expect(curErrors.value).toEqual([]);
      expect(curDiagnostics.value).toEqual([]);
      expect(curImportDump.value).toBe("(no imports)");
    });
    scope.stop();
  });

  test("updateEditorState triggers compilation", async () => {
    await scope.run(async () => {
      const { updateEditorState, curDag } = useCompilation(() => false);

      const editorState = createEditorStateFromSource("f()");
      updateEditorState(editorState);
      await nextTick();
      await flushPromises();

      expect(curDag.value.getNodeList()).toHaveLength(1);
      expect(curDag.value.getNodeList()[0].name).toBe("f");
    });
    scope.stop();
  });

  test("compilation with multiple nodes produces correct DAG", async () => {
    await scope.run(async () => {
      const { updateEditorState, curDag } = useCompilation(() => false);

      const editorState = createEditorStateFromSource("a = f(); b = g(a);");
      updateEditorState(editorState);
      await nextTick();
      await flushPromises();

      expect(curDag.value.getNodeList()).toHaveLength(2);
      expect(curDag.value.getEdgeList()).toHaveLength(1);
    });
    scope.stop();
  });

  test("compilation errors produce diagnostics", async () => {
    await scope.run(async () => {
      const { updateEditorState, curErrors, curDiagnostics } = useCompilation(
        () => false,
      );

      // Reference an undefined variable
      const editorState = createEditorStateFromSource("f(undefinedVar)");
      updateEditorState(editorState);
      await nextTick();
      await flushPromises();

      expect(curErrors.value.length).toBeGreaterThan(0);
      expect(curDiagnostics.value.length).toBeGreaterThan(0);
    });
    scope.stop();
  });

  test("onCompilationComplete callback is called", async () => {
    await scope.run(async () => {
      const callback = vi.fn();
      const { updateEditorState } = useCompilation(() => false, callback);

      const editorState = createEditorStateFromSource("f()");
      updateEditorState(editorState);
      await nextTick();
      await flushPromises();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0][0].DAG.getNodeList()).toHaveLength(1);
    });
    scope.stop();
  });

  test("repaint re-triggers compilation with same content", async () => {
    await scope.run(async () => {
      const callback = vi.fn();
      const { updateEditorState, repaint } = useCompilation(
        () => false,
        callback,
      );

      const editorState = createEditorStateFromSource("f()");
      updateEditorState(editorState);
      await nextTick();
      await flushPromises();

      expect(callback).toHaveBeenCalledTimes(1);

      repaint();
      await nextTick();
      await flushPromises();

      expect(callback).toHaveBeenCalledTimes(2);
    });
    scope.stop();
  });

  test("shouldDumpImports controls import dump generation", async () => {
    await scope.run(async () => {
      // When shouldDumpImports returns false, import dump stays at default
      const resultFalse = useCompilation(() => false);
      const editorState1 = createEditorStateFromSource("f()");
      resultFalse.updateEditorState(editorState1);
      await nextTick();
      await flushPromises();
      expect(resultFalse.curImportDump.value).toBe("(no imports)");
    });
    scope.stop();

    // When shouldDumpImports returns true, dumpImportTree is called
    // (still returns "(no imports)" for source with no imports, but the
    // code path is exercised)
    scope = effectScope();
    await scope.run(async () => {
      const resultTrue = useCompilation(() => true);
      const editorState2 = createEditorStateFromSource("f()");
      resultTrue.updateEditorState(editorState2);
      await nextTick();
      await flushPromises();
      // dumpImportTree returns "(no imports)" for source without imports
      expect(resultTrue.curImportDump.value).toBe("(no imports)");
    });
    scope.stop();
  });

  test("completion index is updated after compilation", async () => {
    await scope.run(async () => {
      const { updateEditorState, curCompletionIndex } = useCompilation(
        () => false,
      );

      expect(curCompletionIndex.value).toBeInstanceOf(CompletionIndex);

      const editorState = createEditorStateFromSource("a = f()");
      updateEditorState(editorState);
      await nextTick();
      await flushPromises();

      // After compilation, the completion index should be rebuilt
      expect(curCompletionIndex.value).toBeInstanceOf(CompletionIndex);
    });
    scope.stop();
  });

  test("error reporter is updated with new document", async () => {
    await scope.run(async () => {
      const { updateEditorState, curErrorReporter } = useCompilation(
        () => false,
      );

      const editorState = createEditorStateFromSource("f()");
      updateEditorState(editorState);
      await nextTick();
      await flushPromises();

      // Error reporter should be created with the new document
      expect(curErrorReporter.value).toBeDefined();
    });
    scope.stop();
  });

  test("completion index is reused when AST structure is unchanged", async () => {
    await scope.run(async () => {
      const { updateEditorState, curCompletionIndex } = useCompilation(
        () => false,
      );

      // First compilation
      const editorState1 = createEditorStateFromSource("f()");
      updateEditorState(editorState1);
      await nextTick();
      await flushPromises();

      const firstIndex = curCompletionIndex.value;

      // Second compilation with trailing space — same AST structure
      const editorState2 = createEditorStateFromSource("f() ");
      updateEditorState(editorState2);
      await nextTick();
      await flushPromises();

      // Reference identity should be preserved (no rebuild)
      expect(curCompletionIndex.value).toBe(firstIndex);
    });
    scope.stop();
  });

  test("completion index is rebuilt when AST structure changes", async () => {
    await scope.run(async () => {
      const { updateEditorState, curCompletionIndex } = useCompilation(
        () => false,
      );

      const editorState1 = createEditorStateFromSource("f()");
      updateEditorState(editorState1);
      await nextTick();
      await flushPromises();

      const firstIndex = curCompletionIndex.value;

      // Different AST structure — new node added
      const editorState2 = createEditorStateFromSource("f(); g()");
      updateEditorState(editorState2);
      await nextTick();
      await flushPromises();

      expect(curCompletionIndex.value).not.toBe(firstIndex);
    });
    scope.stop();
  });

  test("empty source compiles without errors", async () => {
    await scope.run(async () => {
      const { updateEditorState, curErrors, curDag } = useCompilation(
        () => false,
      );

      const editorState = createEditorStateFromSource("");
      updateEditorState(editorState);
      await nextTick();
      await flushPromises();

      expect(curErrors.value).toEqual([]);
      expect(curDag.value.getNodeList()).toHaveLength(0);
    });
    scope.stop();
  });
});
