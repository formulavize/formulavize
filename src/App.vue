<template>
  <header>
    <HelloWorld msg="Hello World!" />
  </header>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <tabs :options="{ useUrlFragment: false }">
        <tab name="Recipe">
          <TextEditor @update-dag="updateDag"/>
        </tab>
        <tab name="Style">
          <p>Test</p>
        </tab>
      </tabs>
    </pane>
    <pane>
      <GraphView :curDag="curDag"/>
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
import { Dag } from "./common/dag"
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import './tabs-component.css';

export default defineComponent({
  name: 'App',
  data() {
    return {
      curDag: new Dag()
    }
  },
  methods: {
    updateDag(dag: Dag) {
      this.curDag = dag
    }
  },
  components: {
    HelloWorld,
    Splitpanes,
    Pane,
    TextEditor,
    GraphView,
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