<template>
  <div id="editorview" ref="editorview" />
</template>

<script lang="ts">
import { debounce } from "lodash";
import { defineComponent, watch } from "vue";

import {
  closeBrackets,
  closeBracketsKeymap,
  autocompletion,
} from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
} from "@codemirror/language";
import { linter, Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, Compartment, Extension } from "@codemirror/state";
import {
  EditorView,
  ViewUpdate,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";

import { fizLanguage } from "@formulavize/lang-fiz";
import { ASTCompletionIndex } from "../compiler/autocompletion";
import { createCompletionSource } from "../compiler/autocompleter";

export default defineComponent({
  name: "TextEditor",
  props: {
    editorDebounceDelay: {
      type: Number,
      default: 300, // ms
    },
    tabToIndent: {
      type: Boolean,
      default: false,
    },
    codeDiagnostics: {
      type: Array as () => Diagnostic[],
      default: () => [],
    },
    completionIndex: {
      type: Object as () => ASTCompletionIndex | undefined,
      required: false,
      default: undefined,
    },
  },
  emits: ["update-editorstate"],
  mounted() {
    const emitEditorState = debounce((updatedState: EditorState): void => {
      this.$emit("update-editorstate", updatedState);
    }, this.editorDebounceDelay);

    const createAutocompletion = (completionIndex?: ASTCompletionIndex) => {
      if (!completionIndex) {
        return autocompletion();
      }
      return autocompletion({
        override: [createCompletionSource(completionIndex)],
      });
    };

    const getKeymap = (isTabbingOn: boolean): Extension => {
      return keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...foldKeymap,
        ...closeBracketsKeymap,
        ...(isTabbingOn ? [indentWithTab] : []),
      ]);
    };

    const keymapCompartment = new Compartment();
    const autocompletionCompartment = new Compartment();

    const editorState = EditorState.create({
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
        linter(() => {
          return this.codeDiagnostics;
        }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((v: ViewUpdate): void => {
          if (v.docChanged) emitEditorState(v.state);
        }),
        keymapCompartment.of(getKeymap(this.tabToIndent)),
        autocompletionCompartment.of(
          createAutocompletion(this.completionIndex),
        ),
        fizLanguage,
      ],
    });

    const view: EditorView = new EditorView({
      state: editorState,
      parent: this.$refs.editorview as Element,
    });
    view.focus();

    watch(
      () => this.tabToIndent,
      (isTabbingOn) => {
        view.dispatch({
          effects: keymapCompartment.reconfigure(getKeymap(isTabbingOn)),
        });
      },
    );

    watch(
      () => this.completionIndex,
      (completionIndex) => {
        view.dispatch({
          effects: autocompletionCompartment.reconfigure(
            createAutocompletion(completionIndex),
          ),
        });
      },
      { deep: true },
    );
  },
});
</script>

<style>
#editorview {
  height: 100%;
}
.cm-editor {
  height: 100%;
}
.cm-wrap {
  height: 100%;
}
.cm-scroller {
  overflow: auto;
}
</style>
