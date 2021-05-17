<template>
  <div ref="editorview" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { EditorState } from "@codemirror/state"
import { EditorView, keymap, drawSelection, highlightActiveLine } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { lineNumbers, highlightActiveLineGutter } from "@codemirror/gutter"
import { history, historyKeymap } from "@codemirror/history"
import { bracketMatching } from "@codemirror/matchbrackets"
import { rectangularSelection } from "@codemirror/rectangular-selection"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"

export default defineComponent({
  name: 'TextEditor',
  mounted(): void {
    let state = EditorState.create({
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        bracketMatching(),
        rectangularSelection(),
        highlightSelectionMatches(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
      ]
    })
    let view: EditorView = new EditorView({
      state: state,
      parent: this.$refs.editorview as Element,
    })
  },
})
</script>