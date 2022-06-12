<template>
  <div id="editorview" ref="editorview" />
</template>

<script lang="ts">

import { defineComponent } from 'vue'

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { 
  bracketMatching, defaultHighlightStyle, 
  foldGutter, foldKeymap,
  syntaxHighlighting
} from "@codemirror/language"
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search"
import { EditorState } from "@codemirror/state"
import { 
  EditorView, ViewUpdate, drawSelection,
  highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars,
  keymap, lineNumbers, rectangularSelection
} from "@codemirror/view"

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
        syntaxHighlighting(defaultHighlightStyle),
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