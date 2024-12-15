<template>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <tabs :options="{ useUrlFragment: false }">
        <tab name="Recipe">
          <TextEditor
            :editor-debounce-delay="editorDebounceDelay"
            @update-editorstate="updateEditorState"
          />
        </tab>
        <tab name="Operators">
          <OperatorsView />
        </tab>
        <tab name="Style">
          <p>Test</p>
        </tab>
      </tabs>
    </pane>
    <pane>
      <GraphView v-if="!debugMode" :cur-dag="curDag as Dag" />
      <tabs v-else :options="{ useUrlFragment: false }">
        <tab name="Output">
          <GraphView :cur-dag="curDag as Dag" />
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
  <footer></footer>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import TextEditor from "./components/TextEditor.vue";
import GraphView from "./components/GraphView.vue";
import TextDumpView from "./components/TextDumpView.vue";
import OperatorsView from "./components/OperatorsView.vue";
import { EditorState } from "@codemirror/state";
import { RecipeTreeNode } from "./compiler/ast";
import { Dag } from "./compiler/dag";
import { Compiler } from "./compiler/driver";
// @ts-ignore: remove once @types/splitpanes upgrades dependency to vue 3
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
    OperatorsView,
  },
  data() {
    return {
      debugMode: true,
      editorDebounceDelay: 300, // ms
      compiler: new Compiler.Driver(),
      curEditorState: EditorState.create(),
      curAst: new RecipeTreeNode(),
      curDag: new Dag(""),
    };
  },
  watch: {
    async curEditorState(newEditorState: EditorState) {
      const curCompilation = await this.compiler.compile(
        newEditorState,
        Compiler.sourceFromEditor,
        Compiler.parseFromEditor,
      );
      this.curAst = curCompilation.AST;
      this.curDag = curCompilation.DAG;
    },
  },
  methods: {
    updateEditorState(editorState: EditorState) {
      this.curEditorState = editorState;
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
#panes {
  height: 80%;
}
</style>
