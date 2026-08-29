import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
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

  // Watchers must be created inside an effect scope so their reactive
  // effects are disposed with the test rather than leaking into the next one.
  function setupCompilation(...args: Parameters<typeof useCompilation>) {
    const compilation = scope.run(() => useCompilation(...args));
    if (!compilation) throw new Error("effect scope was stopped before setup");
    return compilation;
  }

  // Compilation is watcher driven and asynchronous, so let both the reactive
  // update and the compiler promise resolve before asserting.
  async function settle(): Promise<void> {
    await nextTick();
    await flushPromises();
  }

  beforeEach(() => {
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  test("initializes with default values", () => {
    const { curAst, curDag, curErrors, curDiagnostics, curImportDump } =
      setupCompilation(() => false);

    expect(curAst.value).toBeInstanceOf(RecipeTreeNode);
    expect(curDag.value).toBeInstanceOf(Dag);
    expect(curErrors.value).toEqual([]);
    expect(curDiagnostics.value).toEqual([]);
    expect(curImportDump.value).toBe("(no imports)");
  });

  test("updateEditorState triggers compilation", async () => {
    const { updateEditorState, curDag } = setupCompilation(() => false);

    updateEditorState(createEditorStateFromSource("f()"));
    await settle();

    expect(curDag.value.getNodeList()).toHaveLength(1);
    expect(curDag.value.getNodeList()[0].name).toBe("f");
  });

  test("compilation with multiple nodes produces correct DAG", async () => {
    const { updateEditorState, curDag } = setupCompilation(() => false);

    updateEditorState(createEditorStateFromSource("a = f(); b = g(a);"));
    await settle();

    expect(curDag.value.getNodeList()).toHaveLength(2);
    expect(curDag.value.getEdgeList()).toHaveLength(1);
  });

  test("compilation errors produce diagnostics", async () => {
    const { updateEditorState, curErrors, curDiagnostics } = setupCompilation(
      () => false,
    );

    // Reference an undefined variable
    updateEditorState(createEditorStateFromSource("f(undefinedVar)"));
    await settle();

    expect(curErrors.value.length).toBeGreaterThan(0);
    expect(curDiagnostics.value.length).toBeGreaterThan(0);
  });

  test("onCompilationComplete callback is called", async () => {
    const callback = vi.fn();
    const { updateEditorState } = setupCompilation(() => false, callback);

    updateEditorState(createEditorStateFromSource("f()"));
    await settle();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].DAG.getNodeList()).toHaveLength(1);
  });

  test("repaint re-triggers compilation with same content", async () => {
    const callback = vi.fn();
    const { updateEditorState, repaint } = setupCompilation(
      () => false,
      callback,
    );

    updateEditorState(createEditorStateFromSource("f()"));
    await settle();

    expect(callback).toHaveBeenCalledTimes(1);

    repaint();
    await settle();

    expect(callback).toHaveBeenCalledTimes(2);
  });

  test("shouldDumpImports controls import dump generation", async () => {
    // When shouldDumpImports returns false, import dump stays at default
    const resultFalse = setupCompilation(() => false);
    resultFalse.updateEditorState(createEditorStateFromSource("f()"));
    await settle();
    expect(resultFalse.curImportDump.value).toBe("(no imports)");

    // When shouldDumpImports returns true, dumpImportTree is called
    // (still returns "(no imports)" for source with no imports, but the
    // code path is exercised)
    const resultTrue = setupCompilation(() => true);
    resultTrue.updateEditorState(createEditorStateFromSource("f()"));
    await settle();
    expect(resultTrue.curImportDump.value).toBe("(no imports)");
  });

  test("completion index is updated after compilation", async () => {
    const { updateEditorState, curCompletionIndex } = setupCompilation(
      () => false,
    );

    expect(curCompletionIndex.value).toBeInstanceOf(CompletionIndex);

    updateEditorState(createEditorStateFromSource("a = f()"));
    await settle();

    // After compilation, the completion index should be rebuilt
    expect(curCompletionIndex.value).toBeInstanceOf(CompletionIndex);
  });

  test("error reporter is updated with new document", async () => {
    const { updateEditorState, curErrorReporter } = setupCompilation(
      () => false,
    );

    updateEditorState(createEditorStateFromSource("f()"));
    await settle();

    // Error reporter should be created with the new document
    expect(curErrorReporter.value).toBeDefined();
  });

  test("completion index is reused when AST structure is unchanged", async () => {
    const { updateEditorState, curCompletionIndex } = setupCompilation(
      () => false,
    );

    // First compilation
    updateEditorState(createEditorStateFromSource("f()"));
    await settle();

    const firstIndex = curCompletionIndex.value;

    // Second compilation with trailing space — same AST structure
    updateEditorState(createEditorStateFromSource("f() "));
    await settle();

    // Reference identity should be preserved (no rebuild)
    expect(curCompletionIndex.value).toBe(firstIndex);
  });

  test("completion index is rebuilt when AST structure changes", async () => {
    const { updateEditorState, curCompletionIndex } = setupCompilation(
      () => false,
    );

    updateEditorState(createEditorStateFromSource("f()"));
    await settle();

    const firstIndex = curCompletionIndex.value;

    // Different AST structure — new node added
    updateEditorState(createEditorStateFromSource("f(); g()"));
    await settle();

    expect(curCompletionIndex.value).not.toBe(firstIndex);
  });

  test("empty source compiles without errors", async () => {
    const { updateEditorState, curErrors, curDag } = setupCompilation(
      () => false,
    );

    updateEditorState(createEditorStateFromSource(""));
    await settle();

    expect(curErrors.value).toEqual([]);
    expect(curDag.value.getNodeList()).toHaveLength(0);
  });
});
