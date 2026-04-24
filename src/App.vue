<template>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <TextEditor
        ref="textEditor"
        :editor-debounce-delay="editorDebounceDelay"
        :enable-tabbing-in-editor="enableTabbingInEditor"
        :code-diagnostics="curDiagnostics"
        :completion-index="curCompletionIndex"
        :debug-mode="debugMode"
        :tutorial-mode="tutorialMode"
        :selected-renderer="selectedRenderer"
        :is-dark="resolvedTheme === 'dark'"
        @update-editorstate="updateEditorState"
      />
    </pane>
    <pane>
      <GraphView
        v-if="!debugMode"
        ref="graphView"
        :cur-dag="curDag as Dag"
        :renderer-component="rendererComponent"
        :is-dark="resolvedTheme === 'dark'"
      />
      <tabs v-else :options="{ useUrlFragment: false }">
        <tab name="Output">
          <GraphView
            ref="graphView"
            :cur-dag="curDag as Dag"
            :renderer-component="rendererComponent"
            :is-dark="resolvedTheme === 'dark'"
          />
        </tab>
        <tab name="AST">
          <TextDumpView title="AST Dump" :content="curAst.debugDumpTree()" />
        </tab>
        <tab name="DAG">
          <TextDumpView title="DAG Dump" :content="curDag.debugDumpDag()" />
        </tab>
        <tab name="Errors">
          <TextDumpView
            title="Error Report"
            :content="curErrorReporter.makeErrorReport(curErrors)"
          />
        </tab>
        <tab name="Autocomplete">
          <TextDumpView
            title="Autocomplete Dump"
            :content="curCompletionIndex.dumpCompletionIndex()"
          />
        </tab>
        <tab name="Imports">
          <TextDumpView title="Import Tree" :content="curImportDump" />
        </tab>
      </tabs>
    </pane>
  </splitpanes>
  <ToolBar
    id="toolbar"
    :tutorial-mode="tutorialMode"
    :class="{ 'toolbar-debug': debugMode }"
    @tutorial-clicked="onTutorialClicked"
    @open-export="showExportPopup = true"
    @open-options="showOptionsPopup = true"
    @copy-source="copySourceToClipboard"
  />
  <ExportOptionsPopup
    v-model:show-export="showExportPopup"
    :supported-export-formats="supportedExportFormats"
    @export-with-options="handleExport"
  />
  <OptionsPopup
    v-model:show-options="showOptionsPopup"
    v-model:enable-tabbing-in-editor="enableTabbingInEditor"
    v-model:debug-mode="debugMode"
    v-model:theme-mode="themeMode"
    v-model:selected-renderer="selectedRenderer"
    :renderer-options="rendererOptions"
  />
  <TutorialLevelSelect
    v-model:show-dialog="showTutorialLevelSelect"
    :modules="tutorialModules"
    :highest-completed-index="tutorialHighestCompleted"
    :module-start-indices="tutorialModuleStartIndices"
    @select-puzzlet="onSelectPuzzlet"
    @restart-tutorial="onRestartTutorial"
  />
  <ConfettiEffect ref="confettiEffect" />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { ExportFormat } from "./compiler/constants";
import TextEditor from "./components/TextEditor.vue";
import GraphView from "./components/GraphView.vue";
import TextDumpView from "./components/TextDumpView.vue";
import ToolBar from "./components/ToolBar.vue";
import ConfettiEffect from "./components/ConfettiEffect.vue";
import ExportOptionsPopup from "./components/ExportOptionsPopup.vue";
import OptionsPopup from "./components/OptionsPopup.vue";
import { Dag } from "./compiler/dag";
import { OptionsStore } from "./optionsStore";
import { TutorialManager } from "./tutorial/tutorialManager";
import TutorialLevelSelect from "./components/TutorialLevelSelect.vue";
import { defaultCubic } from "./tutorial/defaultExample";
import { useAppTheme } from "./composables/useAppTheme";
import { useCompilation } from "./composables/useCompilation";
import { useRendererRegistry } from "./composables/useRendererRegistry";
// @ts-expect-error: remove once @types/splitpanes upgrades dependency to vue 3
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import "./tabs-component.css";

// Template refs
const textEditor = ref<InstanceType<typeof TextEditor> | null>(null);
const graphView = ref<InstanceType<typeof GraphView> | null>(null);
const confettiEffect = ref<InstanceType<typeof ConfettiEffect> | null>(null);

// Local state
const editorDebounceDelay = 300; // ms
const optionsStore = new OptionsStore();
const debugMode = ref(false);
const enableTabbingInEditor = ref(false);
const showExportPopup = ref(false);
const showOptionsPopup = ref(false);
const tutorialMode = ref(false);
const savedEditorText = ref("");
const tutorialManager = new TutorialManager();
const showTutorialLevelSelect = ref(false);
const tutorialStartIndex = ref<number | null>(null);

// Composables
const { themeMode, resolvedTheme, applyTheme } = useAppTheme();

const {
  curEditorState,
  curAst,
  curDag,
  curErrors,
  curDiagnostics,
  curErrorReporter,
  curCompletionIndex,
  curImportDump,
  updateEditorState,
  repaint,
  copySourceToClipboard,
} = useCompilation(
  () => debugMode.value,
  (compilation) => {
    if (tutorialMode.value) {
      tutorialManager.onCompilation(compilation);
    }
  },
);

const {
  selectedRenderer,
  rendererComponent,
  rendererOptions,
  supportedExportFormats,
} = useRendererRegistry("cytoscape", repaint);

// Tutorial computed properties
const tutorialModules = computed(() =>
  tutorialManager.getLesson().getModules(),
);
const tutorialHighestCompleted = computed(
  () => tutorialManager.cachedHighestCompleted,
);
const tutorialModuleStartIndices = computed(() =>
  tutorialManager.getLesson().getAllModuleStartIndices(),
);

// Options persistence
function persistOptions() {
  optionsStore.save({
    enableTabbingInEditor: enableTabbingInEditor.value,
    debugMode: debugMode.value,
    selectedRenderer: selectedRenderer.value,
    themeMode: themeMode.value,
  });
}

watch(enableTabbingInEditor, () => persistOptions());
watch(debugMode, (newVal: boolean) => {
  tutorialManager.setDisableAnimations(newVal);
  repaint();
  persistOptions();
});
watch(resolvedTheme, (newTheme) => applyTheme(newTheme));
watch(themeMode, () => persistOptions());
watch(selectedRenderer, () => persistOptions());

watch(tutorialMode, (newVal: boolean) => {
  try {
    if (newVal) {
      savedEditorText.value = curEditorState.value.doc.toString();
      if (tutorialStartIndex.value !== null) {
        tutorialManager.startTutorialAt(tutorialStartIndex.value);
        tutorialStartIndex.value = null;
      } else {
        tutorialManager.startTutorialAt(0);
      }
    } else {
      tutorialManager.stopTutorial();
      textEditor.value?.setEditorText(savedEditorText.value);
    }
  } catch (err) {
    console.error("Error toggling tutorial mode:", err);
    tutorialMode.value = false;
  }
});

// Methods
function handleExport(exportOptions: {
  fileName: string;
  fileType: ExportFormat;
  scalingFactor: number;
}) {
  graphView.value?.export(exportOptions);
}

function onTutorialClicked() {
  if (tutorialMode.value) {
    tutorialMode.value = false;
  } else if (tutorialManager.hasProgress()) {
    showTutorialLevelSelect.value = true;
  } else {
    tutorialMode.value = true;
  }
}

function onSelectPuzzlet(puzzletIndex: number) {
  showTutorialLevelSelect.value = false;
  tutorialStartIndex.value = puzzletIndex;
  tutorialMode.value = true;
}

function onRestartTutorial() {
  showTutorialLevelSelect.value = false;
  tutorialManager.clearProgress();
  tutorialMode.value = true;
}

// Lifecycle
onMounted(() => {
  const savedOptions = optionsStore.load();
  enableTabbingInEditor.value = savedOptions.enableTabbingInEditor;
  debugMode.value = savedOptions.debugMode;
  selectedRenderer.value = savedOptions.selectedRenderer;
  themeMode.value = savedOptions.themeMode ?? "system";

  applyTheme(resolvedTheme.value);

  tutorialManager.setCallbacks(
    (text: string) => textEditor.value?.setEditorText(text),
    (text: string) => textEditor.value?.setTutorialHeaderText(text),
    (text: string) => textEditor.value?.setExamplesText(text),
    () => {
      tutorialMode.value = false;
    },
    () => {
      confettiEffect.value?.triggerConfetti();
    },
  );
  tutorialManager.setDisableAnimations(debugMode.value);
  textEditor.value?.setEditorText(defaultCubic);
});
</script>

<style>
html,
body,
#app {
  height: 100%;
  width: 100%;
  margin: 0;
}

:root {
  --fviz-bg: #fff;
  --fviz-bg-secondary: #f5f5f5;
  --fviz-border: #eee;
  --fviz-border-strong: #ddd;
  --fviz-text: #000;
  --fviz-text-muted: #999;
  --fviz-text-hover: #666;
}

html.dark {
  --fviz-bg: #121212;
  --fviz-bg-secondary: #1e1e1e;
  --fviz-border: #333;
  --fviz-border-strong: #444;
  --fviz-text: #e0e0e0;
  --fviz-text-muted: #888;
  --fviz-text-hover: #bbb;
}

html.dark .splitpanes.default-theme .splitpanes__splitter {
  background-color: #333;
}

html.dark .splitpanes.default-theme .splitpanes__splitter:before,
html.dark .splitpanes.default-theme .splitpanes__splitter:after {
  background-color: #888;
}
</style>

<style scoped>
#toolbar {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
}

#toolbar.toolbar-debug {
  top: 33px;
}
</style>
