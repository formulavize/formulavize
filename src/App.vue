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
      <GraphView v-if="!debugMode" :cur-dag="curDag" />
      <tabs v-else :options="{ useUrlFragment: false }">
        <tab name="Output">
          <GraphView :cur-dag="curDag" />
        </tab>
        <tab name="AST">
          <TextDumpView title="AST Dump" :content="astTextDump" />
        </tab>
        <tab name="DAG">
          <TextDumpView title="DAG Dump" :content="dagTextDump" />
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
import { makeDag } from "./compiler/dagFactory";
import { makeRecipeTree } from "./compiler/astFactory";
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
    curRecipeTree(): RecipeTreeNode {
      return makeRecipeTree(this.curEditorState as EditorState);
    },
    curDag(): Dag {
      return makeDag(this.curRecipeTree);
    },
    astTextDump(): string {
      return this.curRecipeTree.formatTree();
    },
    dagTextDump(): string {
      return this.curDag.formatDag();
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
