<template>
  <splitpanes id="panes" class="default-theme">
    <pane>
      <TextEditor
        ref="textEditor"
        :editor-debounce-delay="editorDebounceDelay"
        :tab-to-indent="tabToIndent"
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
      />
      <tabs v-else :options="{ useUrlFragment: false }">
        <tab name="Output">
          <GraphView
            ref="graphView"
            :cur-dag="curDag as Dag"
            :renderer-component="rendererComponent"
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
    v-model:tab-to-indent="tabToIndent"
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

<script lang="ts">
import { defineComponent, markRaw, onBeforeUnmount } from "vue";
import { cloneDeep } from "lodash";
import { EditorState, Text } from "@codemirror/state";
import { Diagnostic } from "@codemirror/lint";
import { ExportFormat } from "./compiler/constants";
import TextEditor from "./components/TextEditor.vue";
import GraphView from "./components/GraphView.vue";
import TextDumpView from "./components/TextDumpView.vue";
import ToolBar from "./components/ToolBar.vue";
import ConfettiEffect from "./components/ConfettiEffect.vue";
import CytoscapeRenderer from "./renderers/cyDag/CytoscapeRenderer.vue";
import MinimalExampleRenderer from "./renderers/minExample/MinimalExampleRenderer.vue";
import { RendererComponent } from "./compiler/rendererTypes";
import ExportOptionsPopup from "./components/ExportOptionsPopup.vue";
import OptionsPopup from "./components/OptionsPopup.vue";
import { RecipeTreeNode } from "./compiler/ast";
import { Dag } from "./compiler/dag";
import { Compiler } from "./compiler/driver";
import { CompilationError } from "./compiler/compilationErrors";
import { errorToDiagnostic, ErrorReporter } from "./compiler/errorReporter";
import { CompletionIndex } from "./autocomplete/autocompletion";
import { createCompletionIndex } from "./autocomplete/autocompletionFactory";
import { dumpImportTree } from "./compiler/importUtility";
import { OptionsStore, ThemeMode } from "./optionsStore";
import { TutorialManager } from "./tutorial/tutorialManager";
import TutorialLevelSelect from "./components/TutorialLevelSelect.vue";
import { defaultCubic } from "./tutorial/defaultExample";
// @ts-expect-error: remove once @types/splitpanes upgrades dependency to vue 3
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import "./tabs-component.css";

export default defineComponent({
  name: "App",
  components: {
    Splitpanes,
    Pane,
    TextEditor,
    GraphView,
    TextDumpView,
    ToolBar,
    ConfettiEffect,
    ExportOptionsPopup,
    OptionsPopup,
    TutorialLevelSelect,
  },
  data() {
    return {
      debugMode: false,
      editorDebounceDelay: 300, // ms
      optionsStore: new OptionsStore(),
      compiler: new Compiler(),
      curEditorState: EditorState.create(),
      curAst: new RecipeTreeNode(),
      curDag: new Dag(""),
      curErrors: [] as CompilationError[],
      curDiagnostics: [] as Diagnostic[],
      curErrorReporter: new ErrorReporter(Text.empty),
      curCompletionIndex: new CompletionIndex(),
      curImportDump: "(no imports)",
      showExportPopup: false,
      showOptionsPopup: false,
      tabToIndent: false,
      selectedRenderer: "cytoscape",
      rendererComponent: markRaw(CytoscapeRenderer) as RendererComponent,
      registeredRenderers: new Map<string, RendererComponent>(),
      tutorialMode: false,
      savedEditorText: "",
      tutorialManager: new TutorialManager(),
      showTutorialLevelSelect: false,
      tutorialStartIndex: null as number | null,
      themeMode: "system" as ThemeMode,
      systemPrefersDark: false,
    };
  },
  computed: {
    rendererOptions(): Array<{ id: string; name: string }> {
      return Array.from(this.registeredRenderers, ([id, renderer]) => ({
        id,
        name: renderer.displayName,
      }));
    },
    tutorialModules() {
      return this.tutorialManager.getLesson().getModules();
    },
    tutorialHighestCompleted(): number {
      return this.tutorialManager.cachedHighestCompleted;
    },
    tutorialModuleStartIndices(): number[] {
      return this.tutorialManager.getLesson().getAllModuleStartIndices();
    },
    resolvedTheme(): "light" | "dark" {
      if (this.themeMode === "system") {
        return this.systemPrefersDark ? "dark" : "light";
      }
      return this.themeMode;
    },
    supportedExportFormats(): readonly ExportFormat[] {
      return (
        this.rendererComponent.supportedExportFormats ||
        Object.values(ExportFormat)
      );
    },
  },
  watch: {
    async curEditorState(newEditorState: EditorState) {
      const curCompilation =
        await this.compiler.compileFromEditor(newEditorState);
      this.curAst = curCompilation.AST;
      this.curDag = curCompilation.DAG;
      this.curErrors = curCompilation.Errors;
      this.curDiagnostics = curCompilation.Errors.map(errorToDiagnostic);
      this.curErrorReporter = new ErrorReporter(newEditorState.doc);
      this.curCompletionIndex = await createCompletionIndex(
        curCompilation.AST,
        (path) =>
          this.compiler.ImportCacher.getCachedCompilation(path)
            .then((c) => c?.AST)
            .catch(() => undefined),
      );
      if (this.debugMode) {
        this.curImportDump = await dumpImportTree(
          this.compiler.ImportCacher,
          curCompilation.AST,
        );
      }
      if (this.tutorialMode) {
        this.tutorialManager.onCompilation(curCompilation);
      }
    },
    tabToIndent() {
      this.persistOptions();
    },
    debugMode(newVal: boolean) {
      this.tutorialManager.setDisableAnimations(newVal);
      this.repaint(); // repaint the conditionally rendered GraphView
      this.persistOptions();
    },
    resolvedTheme(newTheme: "light" | "dark") {
      this.applyTheme(newTheme);
    },
    themeMode() {
      this.persistOptions();
    },
    selectedRenderer(newRendererId: string) {
      const renderer = this.registeredRenderers.get(newRendererId);
      if (renderer) {
        this.rendererComponent = renderer;
        this.repaint(); // repaint the GraphView with new renderer
      } else {
        console.error(`Renderer with id "${newRendererId}" not found`);
      }
      this.persistOptions();
    },
    tutorialMode(newVal: boolean) {
      try {
        if (newVal) {
          this.savedEditorText = this.curEditorState.doc.toString();
          if (this.tutorialStartIndex !== null) {
            this.tutorialManager.startTutorialAt(this.tutorialStartIndex);
            this.tutorialStartIndex = null;
          } else {
            this.tutorialManager.startTutorialAt(0);
          }
        } else {
          this.tutorialManager.stopTutorial();
          const textEditor = this.$refs.textEditor as typeof TextEditor;
          textEditor?.setEditorText(this.savedEditorText);
        }
      } catch (err) {
        console.error("Error toggling tutorial mode:", err);
        this.tutorialMode = false;
      }
    },
  },
  mounted() {
    this.registerRenderer(
      "cytoscape",
      markRaw(CytoscapeRenderer) as RendererComponent,
    );
    this.registerRenderer(
      "minimal",
      markRaw(MinimalExampleRenderer) as RendererComponent,
    );

    const savedOptions = this.optionsStore.load();
    this.tabToIndent = savedOptions.tabToIndent;
    this.debugMode = savedOptions.debugMode;
    this.selectedRenderer = savedOptions.selectedRenderer;
    this.themeMode = savedOptions.themeMode ?? "system";

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.systemPrefersDark = mediaQuery.matches;
    const handler = (e: MediaQueryListEvent) => {
      this.systemPrefersDark = e.matches;
    };
    mediaQuery.addEventListener("change", handler);
    onBeforeUnmount(() => {
      mediaQuery.removeEventListener("change", handler);
    });
    this.applyTheme(this.resolvedTheme);
    const textEditor = this.$refs.textEditor as typeof TextEditor;
    const confettiEffect = this.$refs.confettiEffect as typeof ConfettiEffect;
    this.tutorialManager.setCallbacks(
      (text: string) => textEditor?.setEditorText(text),
      (text: string) => textEditor?.setTutorialHeaderText(text),
      (text: string) => textEditor?.setExamplesText(text),
      () => {
        this.tutorialMode = false;
      },
      () => {
        confettiEffect?.triggerConfetti();
      },
    );
    this.tutorialManager.setDisableAnimations(this.debugMode);
    textEditor?.setEditorText(defaultCubic);
  },
  methods: {
    applyTheme(theme: "light" | "dark") {
      this.$vuetify.theme.change(theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
    },
    persistOptions() {
      this.optionsStore.save({
        tabToIndent: this.tabToIndent,
        debugMode: this.debugMode,
        selectedRenderer: this.selectedRenderer,
        themeMode: this.themeMode,
      });
    },
    repaint() {
      const existingEditorState = cloneDeep(this.curEditorState);
      this.updateEditorState(existingEditorState as EditorState);
    },
    registerRenderer(id: string, renderer: RendererComponent): void {
      this.registeredRenderers.set(id, renderer);
    },
    updateEditorState(editorState: EditorState) {
      this.curEditorState = editorState;
    },
    handleExport(exportOptions: {
      fileName: string;
      fileType: ExportFormat;
      scalingFactor: number;
    }) {
      const graphView = this.$refs.graphView as typeof GraphView;
      graphView.export(exportOptions);
    },
    onTutorialClicked() {
      if (this.tutorialMode) {
        this.tutorialMode = false;
      } else if (this.tutorialManager.hasProgress()) {
        this.showTutorialLevelSelect = true;
      } else {
        this.tutorialMode = true;
      }
    },
    onSelectPuzzlet(puzzletIndex: number) {
      this.showTutorialLevelSelect = false;
      this.tutorialStartIndex = puzzletIndex;
      this.tutorialMode = true;
    },
    onRestartTutorial() {
      this.showTutorialLevelSelect = false;
      this.tutorialManager.clearProgress();
      this.tutorialMode = true;
    },
    async copySourceToClipboard() {
      try {
        const sourceText = this.curEditorState.doc.toString();
        await navigator.clipboard.writeText(sourceText);
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
      }
    },
  },
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
