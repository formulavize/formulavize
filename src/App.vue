<template>
  <header>
    <HelloWorld msg="Hello World!" />
  </header>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <tabs :options="{ useUrlFragment: false }">
        <tab name="Recipe">
          <TextEditor @update-editorstate="updateEditorState"/>
        </tab>
        <tab name="Style">
          <p>Test</p>
        </tab>
      </tabs>
    </pane>
    <pane>
      <GraphView :curDag="curDag"/>
      <!--<TextDumpView title="AST Dump" :content="astTextDump"/>-->
      <!--<TextDumpView title="DAG Dump" :content="dagTextDump"/>-->
    </pane>
  </splitpanes>
  <footer>
  </footer>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
import TextEditor from './components/TextEditor.vue'
import GraphView from './components/GraphView.vue'
import TextDumpView from './components/TextDumpView.vue'
import { EditorState } from "@codemirror/state"
import { BaseTreeNode, RecipeTreeNode } from "./common/ast"
import { Dag } from './common/dag'
import { makeDag } from './common/dagFactory'
import { fillTree } from './common/treeFactory'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import './tabs-component.css';

export default defineComponent({
  name: 'App',
  data() {
    return {
      curEditorState: EditorState.create()
    }
  },
  computed: {
    curRecipeTree(): BaseTreeNode {
      return fillTree(this.curEditorState as EditorState)
    },
    curDag(): Dag {
      return makeDag(this.curRecipeTree as RecipeTreeNode)
    },
    astTextDump(): String {
      return this.curRecipeTree.formatTree()
    },
    dagTextDump(): String {
      return this.curDag.formatDag()
    }
  },
  methods: {
    updateEditorState(editorState: EditorState) {
      this.curEditorState = editorState
    }
  },
  components: {
    HelloWorld,
    Splitpanes,
    Pane,
    TextEditor,
    GraphView,
    TextDumpView
  }
})
</script>

<style>
  html, body, #app {
    height: 100%;
    width: 100%;
    margin: 0;
  }
</style>

<style scoped>
  #panes { height: 80%; }
</style>