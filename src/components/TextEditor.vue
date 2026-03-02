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
  Annotation,
  SelectionRange,
  EditorSelection,
  StateEffect,
  StateEffectType,
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
import { CompletionIndex } from "../autocomplete/autocompletion";
import { getAllDynamicCompletionSources } from "../autocomplete/autocompleter";

// Tutorial header protection logic
// This logic ensures that the tutorial header (a section of the editor
// reserved for tutorial instructions) cannot be edited by the user when tutorial mode is enabled.

// Factory function to create a number-based StateField that responds to a StateEffect
const createNumberStateField = (stateEffect: StateEffectType<number>) =>
  StateField.define<number>({
    create() {
      return 0;
    },
    update(value, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(stateEffect)) {
          value = effect.value;
        }
      }
      return value;
    },
  });

// StateEffect to set the length of the read-only tutorial header
const setReadOnlyHeaderLengthEffect = StateEffect.define<number>();
// StateField to track the length of the tutorial header
const readOnlyHeaderLengthField = createNumberStateField(
  setReadOnlyHeaderLengthEffect,
);

// StateEffect to set the position where examples end
const setExamplesEndPositionEffect = StateEffect.define<number>();
// StateField to track where the examples section ends
const examplesEndPositionField = createNumberStateField(
  setExamplesEndPositionEffect,
);

// Annotation to bypass write protection when programmatically updating the editor content
const bypassWriteProtection = Annotation.define<boolean>();

// Transaction filter to block edits in the tutorial header
const readOnlyHeaderTransactionFilter = EditorState.transactionFilter.of(
  (transaction) => {
    if (!transaction.docChanged) return transaction;
    if (transaction.annotation(bypassWriteProtection)) return transaction;
    const headerLength = transaction.startState.field(
      readOnlyHeaderLengthField,
    );
    if (headerLength <= 0) return transaction;
    let isInputBlocked = false;
    transaction.changes.iterChanges((fromA) => {
      if (fromA < headerLength) isInputBlocked = true;
    });
    return isInputBlocked ? [] : transaction;
  },
);

const createTutorialHeaderProtection = (enabled: boolean): Extension => {
  return enabled ? [readOnlyHeaderTransactionFilter] : [];
};

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
      type: Object as () => CompletionIndex | undefined,
      required: false,
      default: undefined,
    },
    debugMode: {
      type: Boolean,
      default: false,
    },
    tutorialMode: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update-editorstate"],
  expose: ["setEditorText", "setTutorialHeaderText", "setExamplesText"],
  data() {
    return {
      editorView: null as EditorView | null,
    };
  },
  mounted() {
    const emitEditorState = debounce((updatedState: EditorState): void => {
      this.$emit("update-editorstate", updatedState);
    }, this.editorDebounceDelay);

    const createAutocompletion = (completionIndex?: CompletionIndex) => {
      if (!completionIndex) {
        return autocompletion();
      }
      return autocompletion({
        override: getAllDynamicCompletionSources(completionIndex),
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
    const tutorialHeaderCompartment = new Compartment();

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
        readOnlyHeaderLengthField,
        examplesEndPositionField,
        tutorialHeaderCompartment.of(
          createTutorialHeaderProtection(this.tutorialMode),
        ),
        fizLanguage,
      ],
    });

    const view: EditorView = new EditorView({
      state: editorState,
      parent: this.$refs.editorview as Element,
    });
    this.editorView = view;
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
      () => this.tutorialMode,
      (isTutorialMode) => {
        const effects = [
          tutorialHeaderCompartment.reconfigure(
            createTutorialHeaderProtection(isTutorialMode),
          ),
        ];
        if (!isTutorialMode) {
          effects.push(setReadOnlyHeaderLengthEffect.of(0));
        }
        view.dispatch({
          effects,
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
  methods: {
    setEditorText(text: string): void {
      if (!this.editorView) return;
      const docLength = this.editorView.state.doc.length;
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: docLength,
          insert: text,
        },
        effects: [setReadOnlyHeaderLengthEffect.of(0)],
        annotations: bypassWriteProtection.of(true),
      });
      this.editorView.dispatch({
        selection: EditorSelection.cursor(this.editorView.state.doc.length),
      });
    },
    setTutorialHeaderText(text: string): void {
      if (!this.editorView) return;
      const headerLength = this.editorView.state.field(
        readOnlyHeaderLengthField,
      );
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: headerLength,
          insert: text,
        },
        effects: [
          setReadOnlyHeaderLengthEffect.of(text.length),
          setExamplesEndPositionEffect.of(0),
        ],
        annotations: bypassWriteProtection.of(true),
      });
    },
    setExamplesText(text: string): void {
      if (!this.editorView) return;
      const headerLength = this.editorView.state.field(
        readOnlyHeaderLengthField,
      );
      const examplesEnd = this.editorView.state.field(examplesEndPositionField);
      const examplesEndPosition = examplesEnd > 0 ? examplesEnd : headerLength;
      this.editorView.dispatch({
        changes: {
          from: headerLength,
          to: examplesEndPosition,
          insert: text,
        },
        effects: [setExamplesEndPositionEffect.of(headerLength + text.length)],
        annotations: bypassWriteProtection.of(true),
      });
    },
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
