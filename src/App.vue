<template>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <TextEditor
        :editor-debounce-delay="editorDebounceDelay"
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
      </tabs>
    </pane>
  </splitpanes>
  <ToolBar
    id="toolbar"
    :debug-mode="debugMode"
    @toggle-debug-mode="toggleDebugMode"
    @export-initiated="openExportPopup"
    @open-options="showOptionsPopup = true"
  />
  <ExportOptionsPopup
    ref="exportOptionsPopup"
    @export-with-options="handleExport"
  />
  <OptionsPopup v-model:show-options="showOptionsPopup" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { cloneDeep } from "lodash";
import { ImageExportFormat } from "./compiler/constants";
import TextEditor from "./components/TextEditor.vue";
import GraphView from "./components/GraphView.vue";
import TextDumpView from "./components/TextDumpView.vue";
import ToolBar from "./components/ToolBar.vue";
import ExportOptionsPopup from "./components/ExportOptionsPopup.vue";
import OptionsPopup from "./components/OptionsPopup.vue";
import { EditorState } from "@codemirror/state";
import { RecipeTreeNode } from "./compiler/ast";
import { Dag } from "./compiler/dag";
import { Compiler } from "./compiler/driver";
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
      showOptionsPopup: false,
    };
  },
  watch: {
    async curEditorState(newEditorState: EditorState) {
      const curCompilation =
        await this.compiler.compileFromEditor(newEditorState);
      this.curAst = curCompilation.AST;
      this.curDag = curCompilation.DAG;
    },
  },
  methods: {
    updateEditorState(editorState: EditorState) {
      this.curEditorState = editorState;
    },
    toggleDebugMode() {
      this.debugMode = !this.debugMode;
      // repaint the conditionally rendered GraphView
      const existingEditorState = cloneDeep(this.curEditorState);
      this.updateEditorState(existingEditorState as EditorState);
    },
    openExportPopup() {
      const exportOptionsPopup = this.$refs
        .exportOptionsPopup as typeof ExportOptionsPopup;
      exportOptionsPopup.openPopup();
    },
    handleExport(exportOptions: {
      fileName: string;
      fileType: ImageExportFormat;
      scalingFactor: number;
    }) {
      const graphView = this.$refs.graphView as typeof GraphView;
      graphView.exportImage(exportOptions);
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
}
</style>
