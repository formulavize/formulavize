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
import {
  EditorState,
  Compartment,
  Extension,
  StateField,
  SelectionRange,
} from "@codemirror/state";
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
  Tooltip,
  showTooltip,
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
    debugMode: {
      type: Boolean,
      default: false,
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

    const createTooltipText = (
      state: EditorState,
      range: SelectionRange,
    ): string => {
      if (range.empty) {
        const line = state.doc.lineAt(range.head);
        const col = range.head - line.from;
        return `${line.number}:${col} [${range.head}]`;
      } else {
        const fromLine = state.doc.lineAt(range.from);
        const fromCol = range.from - fromLine.from;
        const toLine = state.doc.lineAt(range.to);
        const toCol = range.to - toLine.from;
        return `${fromLine.number}:${fromCol}-${toLine.number}:${toCol} [${range.from}-${range.to}]`;
      }
    };

    const getCursorTooltips = (state: EditorState): readonly Tooltip[] => {
      return state.selection.ranges.map((range) => {
        return {
          pos: range.head,
          above: true,
          arrow: true,
          create: () => {
            const dom = document.createElement("div");
            dom.className = "cm-tooltip-cursor";
            dom.textContent = createTooltipText(state, range);
            return { dom };
          },
        };
      });
    };

    const cursorTooltipField = StateField.define<readonly Tooltip[]>({
      create: getCursorTooltips,
      update(tooltips, transaction) {
        if (!transaction.docChanged && !transaction.selection) return tooltips;
        return getCursorTooltips(transaction.state);
      },
      provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
    });

    const cursorTooltipBaseTheme = EditorView.baseTheme({
      ".cm-tooltip.cm-tooltip-cursor": {
        backgroundColor: "#33acff",
        color: "white",
        border: "none",
        padding: "2px 7px",
        borderRadius: "4px",
        fontSize: "12px",
        "& .cm-tooltip-arrow:before": {
          borderTopColor: "#33acff",
          borderBottomColor: "#33acff",
        },
        "& .cm-tooltip-arrow:after": {
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
        },
      },
    });

    const createCursorTooltip = (isDebugMode: boolean): Extension[] => {
      return isDebugMode ? [cursorTooltipField, cursorTooltipBaseTheme] : [];
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
    const cursorTooltipCompartment = new Compartment();

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
        cursorTooltipCompartment.of(createCursorTooltip(this.debugMode)),
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

    watch(
      () => this.debugMode,
      (isDebugMode) => {
        view.dispatch({
          effects: cursorTooltipCompartment.reconfigure(
            createCursorTooltip(isDebugMode),
          ),
        });
      },
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
