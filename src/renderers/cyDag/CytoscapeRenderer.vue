<template>
  <div class="cytoscape-wrapper">
    <div ref="container" class="cytoscape-renderer" />
    <div ref="popperContainer" class="popper-overlay" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import cytoscape, {
  Core,
  ElementsDefinition,
  Layouts,
  StylesheetCSS,
} from "cytoscape";
import cytoscapePopper, {
  PopperFactory,
  PopperInstance,
  PopperOptions,
} from "cytoscape-popper";
import {
  computePosition,
  ReferenceElement,
  FloatingElement,
} from "@floating-ui/dom";
// @ts-expect-error: missing types
import svg from "cytoscape-svg";
import { makeCyElements } from "./cyGraphFactory";
import { makeCyStylesheets } from "./cyStyleSheetsFactory";
import { getCanvasBackgroundColor } from "./cyRendererDirectives";
import {
  makeLayoutOptions,
  getLayoutSignature,
  getDagLayoutProvider,
} from "./cyLayout";
import { ensureLayoutRegistered } from "./cyLayoutExtensions";
import { captureNodePositions, applyNodePositions } from "./cyNodePositions";
import { exportCyToBlob } from "./cyExport";
import {
  setupCyPoppers,
  addDescriptionGhostNodes,
  PopperCleanup,
} from "./cyPopperExtender";
import { diffCyElements, applyDataUpdates } from "./cyDiffer";
import { Dag } from "../../compiler/dag";
import { ExportFormat } from "../../compiler/constants";
import { saveAs } from "file-saver";
import {
  FileExportOptions,
  RendererComponent,
} from "../../compiler/rendererTypes";

declare module "cytoscape-popper" {
  // PopperOptions extends ComputePositionConfig from @floating-ui/dom
  interface PopperInstance {
    update(): void;
  }
}

const popperFactory: PopperFactory = (
  ref: ReferenceElement,
  content: FloatingElement,
  opts?: PopperOptions,
): PopperInstance => {
  const popperOptions = {
    // see https://floating-ui.com/docs/computePosition#options
    ...opts,
  };

  function update() {
    computePosition(ref, content, popperOptions).then(({ x, y }) => {
      Object.assign(content.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  }
  update();
  return { update };
};

// Layout extensions register lazily in runLayout so the large elk bundle
// are only fetched by recipes that ask for them.
cytoscape.use(cytoscapePopper(popperFactory));
cytoscape.use(svg);

/**
 * CytoscapeRenderer - A renderer using Cytoscape.js for DAG visualization.
 */
const CytoscapeRenderer = defineComponent({
  name: "CytoscapeRenderer",
  props: {
    dag: {
      type: Object as PropType<Dag>,
      required: true,
    },
    isDark: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      cy: null as Core | null,
      previousElements: null as ElementsDefinition | null,
      previousStylesheetsJson: null as string | null,
      previousLayoutSignature: null as string | null,
      runningLayout: null as Layouts | null,
      popperCleanup: null as PopperCleanup | null,
    };
  },
  watch: {
    dag() {
      this.updateDag(this.dag);
    },
    isDark() {
      this.applyThemeStyles();
    },
  },
  mounted(): void {
    this.initializeCytoscape();
  },
  beforeUnmount(): void {
    if (this.cy) {
      this.cy.destroy();
      // A layout awaiting its extension checks this before touching the core.
      this.cy = null;
    }
  },
  methods: {
    initializeCytoscape(): void {
      this.cy = cytoscape({
        container: this.$refs.container as HTMLElement,
      });
      this.applyGrabbability();
      this.updateDag(this.dag);
    },

    // A layout that places nothing needs its nodes draggable; otherwise the
    // user could never manually arrange them.
    applyGrabbability(): void {
      if (!this.cy) return;
      const { nodesAlwaysGrabbable } = getDagLayoutProvider(this.dag);
      this.cy.autoungrabify(!nodesAlwaysGrabbable);
    },

    // Layout is an expensive operation regardless of a change's size.
    async runLayout(): Promise<void> {
      const layoutOptions = makeLayoutOptions(this.dag);
      try {
        // Awaiting registration also keeps layout off the synchronous update
        // path. elk is only downloaded when a recipe asks for it.
        await ensureLayoutRegistered(cytoscape, layoutOptions.name);
      } catch (error) {
        console.error(`Failed to load the ${layoutOptions.name} layout`, error);
        return;
      }
      // The component may have unmounted while the extension was downloading.
      if (!this.cy) return;
      // elk positions nodes asynchronously, so a superseded run has to
      // be stopped or it would overwrite the newer layout's positions.
      this.runningLayout?.stop();
      this.runningLayout = this.cy.layout(layoutOptions);
      this.runningLayout.run();
    },

    applyStyles(newStylesheets: StylesheetCSS[]): void {
      if (!this.cy) return;
      const stylesheetsJson = JSON.stringify(newStylesheets);
      if (stylesheetsJson !== this.previousStylesheetsJson) {
        this.cy.style(newStylesheets).update();
        this.cy.forceRender();
        this.previousStylesheetsJson = stylesheetsJson;
      }
    },

    // Paint the container with the '^cytoscape' background so the editor shows
    // what an export will contain. Clearing the inline style hands the
    // background back to the themed --fviz-bg rule.
    applyCanvasBackground(): void {
      const container = this.$refs.container as HTMLElement | undefined;
      if (!container) return;
      container.style.backgroundColor =
        getCanvasBackgroundColor(this.dag) ?? "";
    },

    applyThemeStyles(): void {
      if (!this.cy) return;
      const newStylesheets = makeCyStylesheets(this.dag, this.isDark);
      this.applyStyles(newStylesheets);
      this.applyCanvasBackground();
    },

    updateDag(dag: Dag): void {
      if (!this.cy) return;

      const newElements = makeCyElements(dag);
      const newStylesheets = makeCyStylesheets(dag, this.isDark);

      this.applyGrabbability();

      if (!this.previousElements) {
        // First render: full build
        this.cy.add(newElements);
        this.applyStyles(newStylesheets);
        this.popperCleanup?.();
        this.popperCleanup = setupCyPoppers(
          this.cy,
          dag,
          this.$refs.popperContainer as HTMLElement,
        );
        this.previousLayoutSignature = getLayoutSignature(dag);
        this.runLayout();
      } else {
        const diff = diffCyElements(this.previousElements, newElements);

        if (diff.topologyChanged) {
          // Layouts that preserve positions (such as manual mode) store node
          // coordinates only in the Cytoscape graph instance, not in the DAG model.
          // Capture current node positions by element ID so they survive the graph
          // element rebuild below and are retained during the layout run.
          const manualPositions = getDagLayoutProvider(dag).preservesPositions
            ? captureNodePositions(this.cy)
            : null;
          // Full replace to preserve elements' visual ordering in Dagre layout.
          // Re-added nodes would otherwise appear at the end of Cytoscape's
          // internal collection, causing Dagre's sort hint to lose to its
          // crossing minimization heuristic.
          // This ensures we get consistent layouts for the same DAG structure.
          this.cy.elements().remove();
          this.cy.add(newElements);
          if (manualPositions) applyNodePositions(this.cy, manualPositions);
        } else {
          applyDataUpdates(this.cy, diff);
        }

        this.applyStyles(newStylesheets);
        this.popperCleanup?.();
        this.popperCleanup = setupCyPoppers(
          this.cy,
          dag,
          this.$refs.popperContainer as HTMLElement,
        );

        // Editing only a '^cytoscape{ layout }' line leaves the element set
        // identical, so the topology check alone would never relayout and the
        // directive would appear to do nothing. Compare the resolved options so
        // an unrecognized value doesn't trigger a pointless relayout.
        const layoutSignature = getLayoutSignature(dag);
        const layoutChanged = layoutSignature !== this.previousLayoutSignature;
        this.previousLayoutSignature = layoutSignature;

        // Avoid unnecessary layout runs by checking if the topology has changed
        if (diff.topologyChanged || layoutChanged) this.runLayout();
      }

      this.applyCanvasBackground();
      this.previousElements = newElements;
    },

    addGhostNodes(): string[] {
      if (!this.cy) return [];
      return addDescriptionGhostNodes(this.cy, this.dag);
    },

    removeGhostNodes(ghostIds: string[]): void {
      if (!this.cy) return;
      for (const id of ghostIds) {
        this.cy.getElementById(id).remove();
      }
    },

    export(exportOptions: FileExportOptions): void {
      if (!this.cy) {
        console.error("Cytoscape instance not initialized");
        return;
      }

      // Create invisible ghost nodes with description text and styling
      // so Cytoscape's canvas-based exporters capture them natively.
      const ghostIds = this.addGhostNodes();

      const imgBlob = exportCyToBlob(this.cy, {
        ...exportOptions,
        backgroundColor: getCanvasBackgroundColor(this.dag),
      });

      this.removeGhostNodes(ghostIds);

      if (!imgBlob) return;
      const fileName = exportOptions.fileName + "." + exportOptions.fileType;
      saveAs(imgBlob, fileName);
    },
  },
});

export default Object.assign(CytoscapeRenderer, {
  displayName: "Cytoscape Renderer",
  supportedExportFormats: [
    ExportFormat.PNG,
    ExportFormat.JPG,
    ExportFormat.SVG,
  ],
}) as RendererComponent;
</script>

<style scoped>
.cytoscape-wrapper {
  position: relative;
  height: 100%;
  width: 100%;
}

.cytoscape-renderer {
  height: 100%;
  width: 100%;
  background-color: var(--fviz-bg);
  border: solid 1px var(--fviz-border);
  box-sizing: border-box;
}

.popper-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
</style>
