<template>
  <div id="editorview" ref="editorview" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { EditorState } from "@codemirror/state"
import { 
  EditorView, keymap, drawSelection, ViewUpdate,
  highlightActiveLine, highlightSpecialChars
} from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { lineNumbers, highlightActiveLineGutter } from "@codemirror/gutter"
import { history, historyKeymap } from "@codemirror/history"
import { bracketMatching } from "@codemirror/matchbrackets"
import { rectangularSelection } from "@codemirror/rectangular-selection"
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search"
import { foldGutter, foldKeymap } from "@codemirror/fold"
import { defaultHighlightStyle } from "@codemirror/highlight"
import { closeBrackets, closeBracketsKeymap } from "@codemirror/closebrackets"
import { commentKeymap } from "@codemirror/comment"
import { fizLanguage } from 'lang-fiz'

export default defineComponent({
  name: 'TextEditor',
  emits: ["update-editorstate"],
  data() {
    return {
      prevTimeoutId: -1
    }
  },
  mounted() {
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
        foldGutter(),
        closeBrackets(),
        defaultHighlightStyle.fallback,
        highlightSpecialChars(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((v:ViewUpdate): void => {
          if (v.docChanged) {
            // delay until typing finishes so we don't process on every keystroke
            clearTimeout(this.prevTimeoutId);
            let timeOut = 500 // ms
            this.prevTimeoutId = setTimeout(() => {
              this.$emit("update-editorstate", v.state)
            }, timeOut)
          }
        }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
          ...closeBracketsKeymap,
          ...commentKeymap,
        ]),
        fizLanguage,
      ]
    })
    let view: EditorView = new EditorView({
      state: state,
      parent: this.$refs.editorview as Element,
    })
    view.focus()
  },
})
</script>

<style>
  #editorview { height: 100%; }
  .cm-editor { height: 100%; }
  .cm-wrap { height: 100%; }
  .cm-scroller { overflow: auto }
</style>