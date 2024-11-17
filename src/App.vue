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
      <GraphView v-if="!debugMode" :cur-dag="compilation.DAG" />
      <tabs v-else :options="{ useUrlFragment: false }">
        <tab name="Output">
          <GraphView :cur-dag="compilation.DAG" />
        </tab>
        <tab name="AST">
          <TextDumpView
            title="AST Dump"
            :content="compilation.AST.debugDumpTree()"
          />
        </tab>
        <tab name="DAG">
          <TextDumpView
            title="DAG Dump"
            :content="compilation.DAG.debugDumpDag()"
          />
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
import { Compilation } from "./compiler/compilation";
import { CompilerDriver } from "./compiler/driver";
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
      curEditorState: EditorState.create(),
    };
  },
  computed: {
    compilation(): Compilation {
      return CompilerDriver.compile(
        this.curEditorState as EditorState,
        CompilerDriver.sourceFromEditor,
        CompilerDriver.parseFromEditor,
      );
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
