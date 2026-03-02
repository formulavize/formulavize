<template>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <TextEditor
        ref="textEditor"
        :editor-debounce-delay="editorDebounceDelay"
        :tab-to-indent="tabToIndent"
        :code-diagnostics="curDiagnostics"
        :completion-index="curCompletionIndex"
        :debug-mode="debugMode"
        :tutorial-mode="tutorialMode"
        @update-editorstate="updateEditorState"
      />
    </pane>
    <pane>
      <GraphView
        v-if="!debugMode"
        ref="graphView"
        :cur-dag="curDag as Dag"
        :renderer-component="rendererComponent"
      />
      <tabs v-else :options="{ useUrlFragment: false }">
        <tab name="Output">
          <GraphView
            ref="graphView"
            :cur-dag="curDag as Dag"
            :renderer-component="rendererComponent"
          />
        </tab>
        <tab name="AST">
          <TextDumpView title="AST Dump" :content="curAst.debugDumpTree()" />
        </tab>
        <tab name="DAG">
          <TextDumpView title="DAG Dump" :content="curDag.debugDumpDag()" />
        </tab>
        <tab name="Errors">
          <TextDumpView
            title="Error Report"
            :content="curErrorReporter.makeErrorReport(curErrors)"
          />
        </tab>
        <tab name="Autocomplete">
          <TextDumpView
            title="Autocomplete Dump"
            :content="curCompletionIndex.dumpCompletionIndex()"
          />
        </tab>
      </tabs>
    </pane>
  </splitpanes>
  <ToolBar
    id="toolbar"
    v-model:tutorial-mode="tutorialMode"
    @open-export="showExportPopup = true"
    @open-options="showOptionsPopup = true"
    @copy-source="copySourceToClipboard"
  />
  <ExportOptionsPopup
    v-model:show-export="showExportPopup"
    :supported-export-formats="supportedExportFormats"
    @export-with-options="handleExport"
  />
  <OptionsPopup
    v-model:show-options="showOptionsPopup"
    v-model:tab-to-indent="tabToIndent"
    v-model:debug-mode="debugMode"
    v-model:selected-renderer="selectedRenderer"
    :renderer-options="rendererOptions"
  />
</template>

<script lang="ts">
import { defineComponent, markRaw } from "vue";
import { cloneDeep } from "lodash";
import { EditorState, Text } from "@codemirror/state";
import { Diagnostic } from "@codemirror/lint";
import { ExportFormat } from "./compiler/constants";
import TextEditor from "./components/TextEditor.vue";
import GraphView from "./components/GraphView.vue";
import TextDumpView from "./components/TextDumpView.vue";
import ToolBar from "./components/ToolBar.vue";
import CytoscapeRenderer from "./renderers/cyDag/CytoscapeRenderer.vue";
import MinimalExampleRenderer from "./renderers/minExample/MinimalExampleRenderer.vue";
import { RendererComponent } from "./compiler/rendererTypes";
import ExportOptionsPopup from "./components/ExportOptionsPopup.vue";
import OptionsPopup from "./components/OptionsPopup.vue";
import { RecipeTreeNode } from "./compiler/ast";
import { Dag } from "./compiler/dag";
import { Compiler } from "./compiler/driver";
import { CompilationError } from "./compiler/compilationErrors";
import { errorToDiagnostic, ErrorReporter } from "./compiler/errorReporter";
import { CompletionIndex } from "./autocomplete/autocompletion";
import { createCompletionIndex } from "./autocomplete/autocompletionFactory";
import { TutorialManager } from "./tutorial/tutorialManager";
// @ts-expect-error: remove once @types/splitpanes upgrades dependency to vue 3
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import "./tabs-component.css";

export default defineComponent({
  name: "App",
  components: {
    Splitpanes,
    Pane,
    TextEditor,
    GraphView,
    TextDumpView,
    ToolBar,
    ExportOptionsPopup,
    OptionsPopup,
  },
  data() {
    return {
      debugMode: false,
      editorDebounceDelay: 300, // ms
      compiler: new Compiler(),
      curEditorState: EditorState.create(),
      curAst: new RecipeTreeNode(),
      curDag: new Dag(""),
      curErrors: [] as CompilationError[],
      curDiagnostics: [] as Diagnostic[],
      curErrorReporter: new ErrorReporter(Text.empty),
      curCompletionIndex: new CompletionIndex(),
      showExportPopup: false,
      showOptionsPopup: false,
      tabToIndent: false,
      selectedRenderer: "cytoscape",
      rendererComponent: markRaw(CytoscapeRenderer) as RendererComponent,
      registeredRenderers: new Map<string, RendererComponent>(),
      tutorialMode: false,
      savedEditorText: "",
      tutorialManager: new TutorialManager(),
    };
  },
  computed: {
    rendererOptions(): Array<{ id: string; name: string }> {
      return Array.from(this.registeredRenderers, ([id, renderer]) => ({
        id,
        name: renderer.displayName,
      }));
    },
    supportedExportFormats(): readonly ExportFormat[] {
      return (
        this.rendererComponent.supportedExportFormats ||
        Object.values(ExportFormat)
      );
    },
  },
  watch: {
    async curEditorState(newEditorState: EditorState) {
      const curCompilation =
        await this.compiler.compileFromEditor(newEditorState);
      this.curAst = curCompilation.AST;
      this.curDag = curCompilation.DAG;
      this.curErrors = curCompilation.Errors;
      this.curDiagnostics = curCompilation.Errors.map(errorToDiagnostic);
      this.curErrorReporter = new ErrorReporter(newEditorState.doc);
      this.curCompletionIndex = await createCompletionIndex(
        curCompilation.AST,
        async (path) =>
          (await this.compiler.ImportCacher.getCachedCompilation(path))?.AST,
      );
      if (this.tutorialMode) {
        this.tutorialManager.onCompilation(curCompilation);
      }
    },
    debugMode(newVal: boolean) {
      this.tutorialManager.setDisableAnimations(newVal);
      this.repaint(); // repaint the conditionally rendered GraphView
    },
    selectedRenderer(newRendererId: string) {
      const renderer = this.registeredRenderers.get(newRendererId);
      if (renderer) {
        this.rendererComponent = renderer;
        this.repaint(); // repaint the GraphView with new renderer
      } else {
        console.error(`Renderer with id "${newRendererId}" not found`);
      }
    },
    tutorialMode(newVal: boolean) {
      try {
        if (newVal) {
          this.savedEditorText = this.curEditorState.doc.toString();
          this.tutorialManager.startTutorial();
        } else {
          this.tutorialManager.stopTutorial();
          const textEditor = this.$refs.textEditor as typeof TextEditor;
          textEditor?.setEditorText(this.savedEditorText);
        }
      } catch (err) {
        console.error("Error toggling tutorial mode:", err);
        this.tutorialMode = false;
      }
    },
  },
  mounted() {
    this.registerRenderer(
      "cytoscape",
      markRaw(CytoscapeRenderer) as RendererComponent,
    );
    this.registerRenderer(
      "minimal",
      markRaw(MinimalExampleRenderer) as RendererComponent,
    );
    const textEditor = this.$refs.textEditor as typeof TextEditor;
    this.tutorialManager.setCallbacks(
      (text: string) => textEditor?.setEditorText(text),
      (text: string) => textEditor?.setTutorialHeaderText(text),
      (text: string) => textEditor?.setExamplesText(text),
      () => {
        this.tutorialMode = false;
      },
    );
    this.tutorialManager.setDisableAnimations(this.debugMode);
  },
  methods: {
    repaint() {
      const existingEditorState = cloneDeep(this.curEditorState);
      this.updateEditorState(existingEditorState as EditorState);
    },
    registerRenderer(id: string, renderer: RendererComponent): void {
      this.registeredRenderers.set(id, renderer);
    },
    updateEditorState(editorState: EditorState) {
      this.curEditorState = editorState;
    },
    handleExport(exportOptions: {
      fileName: string;
      fileType: ExportFormat;
      scalingFactor: number;
    }) {
      const graphView = this.$refs.graphView as typeof GraphView;
      graphView.export(exportOptions);
    },
    async copySourceToClipboard() {
      try {
        const sourceText = this.curEditorState.doc.toString();
        await navigator.clipboard.writeText(sourceText);
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
      }
    },
  },
});
</script>

<style>
html,
body,
#app {
  height: 100%;
  width: 100%;
  margin: 0;
}
</style>

<style scoped>
#toolbar {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  pointer-events: none;
}

#toolbar * {
  pointer-events: auto;
}
</style>
