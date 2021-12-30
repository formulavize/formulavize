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
        <tab name="Operators">
          <OperatorsView @update-opbundle="updateOpBundle"/>
        </tab>
        <tab name="Style">
          <p>Test</p>
        </tab>
      </tabs>
    </pane>
    <pane>
      <GraphView v-if="!debugMode" :curDag="curDag" :curOpBundle="curOpBundle"/>
      <tabs v-else :options="{ useUrlFragment: false }">
        <tab name="Output">
          <GraphView :curDag="curDag" :curOpBundle="curOpBundle"/>
        </tab>
        <tab name="AST">
          <TextDumpView title="AST Dump" :content="astTextDump"/>
        </tab>
        <tab name="DAG">
          <TextDumpView title="DAG Dump" :content="dagTextDump"/>
        </tab>
      </tabs>
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
import OperatorsView from './components/OperatorsView.vue'
import { EditorState } from "@codemirror/state"
import { RecipeTreeNode } from "./common/ast"
import { Dag } from './common/dag'
import { makeDag } from './common/dagFactory'
import { fillTree } from './common/treeFactory'
import { OpBundle } from './common/opBundle'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import './tabs-component.css';

export default defineComponent({
  name: 'App',
  data() {
    return {
      debugMode: true,
      curEditorState: EditorState.create(),
      curOpBundle: new OpBundle("")
    }
  },
  computed: {
    curRecipeTree(): RecipeTreeNode {
      return fillTree(this.curEditorState as EditorState)
    },
    curDag(): Dag {
      return makeDag(this.curRecipeTree)
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
    },
    updateOpBundle(opBundle: OpBundle) {
      this.curOpBundle = opBundle
    }
  },
  components: {
    HelloWorld,
    Splitpanes,
    Pane,
    TextEditor,
    GraphView,
    TextDumpView,
    OperatorsView
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