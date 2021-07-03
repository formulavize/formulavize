<template>
  <header>
    <HelloWorld msg="Hello World!" />
  </header>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <TextEditor />
    </pane>
    <pane>
      <GraphView />
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
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

export default defineComponent({
  name: 'App',
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