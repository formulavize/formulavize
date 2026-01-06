<template>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <TextEditor
        :editor-debounce-delay="editorDebounceDelay"
        :tab-to-indent="tabToIndent"
        :code-diagnostics="curDiagnostics"
        :completion-index="curCompletionIndex"
        :debug-mode="debugMode"
        @update-editorstate="updateEditorState"
      />
    </pane>
    <pane>
      <GraphView v-if="!debugMode" ref="graphView" :cur-dag="curDag as Dag" />
      <tabs v-else :options="{ useUrlFragment: false }">
        <tab name="Output">
          <GraphView ref="graphView" :cur-dag="curDag as Dag" />
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
    @open-export="showExportPopup = true"
    @open-options="showOptionsPopup = true"
    @copy-source="copySourceToClipboard"
  />
  <ExportOptionsPopup
    v-model:show-export="showExportPopup"
    @export-with-options="handleExport"
  />
  <OptionsPopup
    v-model:show-options="showOptionsPopup"
    v-model:tab-to-indent="tabToIndent"
    v-model:debug-mode="debugMode"
  />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { cloneDeep } from "lodash";
import { EditorState, Text } from "@codemirror/state";
import { Diagnostic } from "@codemirror/lint";
import { ImageExportFormat } from "./compiler/constants";
import TextEditor from "./components/TextEditor.vue";
import GraphView from "./components/GraphView.vue";
import TextDumpView from "./components/TextDumpView.vue";
import ToolBar from "./components/ToolBar.vue";
import ExportOptionsPopup from "./components/ExportOptionsPopup.vue";
import OptionsPopup from "./components/OptionsPopup.vue";
import { RecipeTreeNode } from "./compiler/ast";
import { Dag } from "./compiler/dag";
import { Compiler } from "./compiler/driver";
import { CompilationError } from "./compiler/compilationErrors";
import { errorToDiagnostic, ErrorReporter } from "./compiler/errorReporter";
import { ASTCompletionIndex } from "./autocomplete/autocompletion";
import { createASTCompletionIndex } from "./autocomplete/autocompletionFactory";
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
      curCompletionIndex: new ASTCompletionIndex(),
      showExportPopup: false,
      showOptionsPopup: false,
      tabToIndent: false,
    };
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
      this.curCompletionIndex = createASTCompletionIndex(curCompilation.AST);
    },
    debugMode() {
      // repaint the conditionally rendered GraphView
      const existingEditorState = cloneDeep(this.curEditorState);
      this.updateEditorState(existingEditorState as EditorState);
    },
  },
  methods: {
    updateEditorState(editorState: EditorState) {
      this.curEditorState = editorState;
    },
    handleExport(exportOptions: {
      fileName: string;
      fileType: ImageExportFormat;
      scalingFactor: number;
    }) {
      const graphView = this.$refs.graphView as typeof GraphView;
      graphView.exportImage(exportOptions);
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
