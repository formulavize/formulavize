<template>
  <HelloWorld msg="Hello World!" />
  <TextEditor />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
import TextEditor from './components/TextEditor.vue'

export default defineComponent({
  name: 'App',
  components: {
    HelloWorld,
    TextEditor,
  }
})
</script>

<style>
</style>