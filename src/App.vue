<template>
  <HelloWorld msg="Hello World!" />
  <TextEditor />
  <GraphView />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
import TextEditor from './components/TextEditor.vue'
import GraphView from './components/GraphView.vue'

export default defineComponent({
  name: 'App',
  components: {
    HelloWorld,
    TextEditor,
    GraphView,
  }
})
</script>

<style>
</style>