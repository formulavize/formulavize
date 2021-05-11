<template>
  <HelloWorld msg="Hello World!" />
  <splitpanes class="default-theme">
    <pane>
      <TextEditor />
    </pane>
    <pane>
      <GraphView />
    </pane>
  </splitpanes>
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
</style>