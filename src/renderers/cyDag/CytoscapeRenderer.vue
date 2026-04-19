<template>
  <div class="cytoscape-wrapper">
    <div ref="container" class="cytoscape-renderer" />
    <div ref="popperContainer" class="popper-overlay" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { match } from "ts-pattern";
import cytoscape, {
  Core,
  ElementsDefinition,
  LayoutOptions,
  NodeSingular,
  StylesheetCSS,
} from "cytoscape";
import dagre from "cytoscape-dagre";
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
import {
  setupCyPoppers,
  collectDescriptions,
  PopperCleanup,
} from "./cyPopperExtender";
import { diffCyElements, applyDiff } from "./cyDiffer";
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

cytoscape.use(dagre);
cytoscape.use(cytoscapePopper(popperFactory));
cytoscape.use(svg);

// Dagre layout options type - refer to dagre documentation and cytoscape-dagre typings
// https://github.com/cytoscape/cytoscape.js-dagre?tab=readme-ov-file#api
type DagreLayoutOptions = LayoutOptions & {
  name: "dagre";
  sort: (a: NodeSingular, b: NodeSingular) => number;
};

// We define a custom sort function to encourage the layout manager
// to follow the insertion order of nodes in the DAG.
// However, Dagre's crossing minimization may still rearrange nodes in a way
// that doesn't preserve the insertion order.
const layoutOptions = {
  name: "dagre",
  sort: (A: NodeSingular, B: NodeSingular) => {
    const orderA: number[] = A.data("order") ?? [];
    const orderB: number[] = B.data("order") ?? [];
    for (let i = 0; i < Math.min(orderA.length, orderB.length); i++) {
      if (orderA[i] !== orderB[i]) return orderA[i] - orderB[i];
    }
    return orderA.length - orderB.length;
  },
} satisfies DagreLayoutOptions;

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
    lockPositions: {
      type: Boolean,
      default: true,
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
    lockPositions(newValue: boolean) {
      if (this.cy) {
        this.cy.autoungrabify(newValue);
      }
    },
  },
  mounted(): void {
    this.initializeCytoscape();
  },
  beforeUnmount(): void {
    if (this.cy) {
      this.cy.destroy();
    }
  },
  methods: {
    initializeCytoscape(): void {
      this.cy = cytoscape({
        container: this.$refs.container as HTMLElement,
      });
      this.cy.autoungrabify(this.lockPositions);
      this.updateDag(this.dag);
    },

    // Layout is an expensive operation regardless of a change's size.
    runLayout(): void {
      Promise.resolve().then(() => {
        if (this.cy) {
          this.cy.layout(layoutOptions).run();
        }
      });
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

    applyThemeStyles(): void {
      if (!this.cy) return;
      const newStylesheets = makeCyStylesheets(this.dag, this.isDark);
      this.applyStyles(newStylesheets);
    },

    updateDag(dag: Dag): void {
      if (!this.cy) return;

      const newElements = makeCyElements(dag);
      const newStylesheets = makeCyStylesheets(dag, this.isDark);

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
        this.runLayout();
      } else {
        const diff = diffCyElements(this.previousElements, newElements);
        applyDiff(this.cy, diff);

        this.applyStyles(newStylesheets);
        this.popperCleanup?.();
        this.popperCleanup = setupCyPoppers(
          this.cy,
          dag,
          this.$refs.popperContainer as HTMLElement,
        );

        // Avoid unnecessary layout runs by checking if the topology has changed
        if (diff.topologyChanged) {
          this.runLayout();
        }
      }

      this.previousElements = newElements;
    },

    addDescriptionGhostNodes(): string[] {
      if (!this.cy) return [];

      const descriptionMap = collectDescriptions(this.cy, this.dag);
      const ghostIds: string[] = [];

      for (const [id, descriptions] of descriptionMap) {
        const ele = this.cy.getElementById(id);
        if (ele.empty()) continue;

        const eleBB = ele.boundingBox({ includeLabels: true });
        const centerX = (eleBB.x1 + eleBB.x2) / 2;
        let nextY = eleBB.y2;

        for (let i = 0; i < descriptions.length; i++) {
          const ghostId = `__ghost_desc_${id}_${i}`;
          const ghostNode = this.cy.add({
            group: "nodes",
            data: { id: ghostId },
          });
          // Position after adding so Cytoscape computes the label dimensions
          const labelHeight = ghostNode.boundingBox({ includeLabels: true }).h;
          nextY += labelHeight / 2;
          ghostNode.position({ x: centerX, y: nextY });
          nextY += labelHeight / 2;
          ghostIds.push(ghostId);
        }
      }

      return ghostIds;
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
      const ghostIds = this.addDescriptionGhostNodes();

      // Issue: the svg exporter rasterizes images in the graph.
      // The workaround for exporting large images is to export a scaled up
      // raster image and then downscale it in an image editor.
      // Ideally, this issue should be addressed in the underlying library.
      // Speculatively, we might be able to swap the image tags in the svg.
      // Svg export is still a useful starting point for those who want to
      // manually edit layouts in an svg editor.
      const scaleFactor = exportOptions.scalingFactor;
      const imgBlob = match(exportOptions.fileType)
        .with(ExportFormat.PNG, () => {
          return this.cy!.png({
            full: true,
            scale: scaleFactor,
            output: "blob",
          });
        })
        .with(ExportFormat.JPG, () => {
          return this.cy!.jpg({
            full: true,
            scale: scaleFactor,
            output: "blob",
          });
        })
        .with(ExportFormat.SVG, () => {
          // @ts-expect-error: missing types
          const svgData = this.cy!.svg({ full: true, scale: scaleFactor });
          return new Blob([svgData], {
            type: "image/svg+xml;charset=utf-8",
          });
        })
        .otherwise((format) => {
          console.error(`Unsupported export format: ${format}`);
          return null;
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
