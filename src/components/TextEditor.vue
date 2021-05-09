<template>
  <div ref="editorview" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

export default defineComponent({
  name: 'TextEditor',
  mounted(): void {
    const view: EditorView = new EditorView({
      state: EditorState.create(),
      parent: this.$refs.editorview as Element,
    })
  },
})
</script>