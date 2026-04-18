<template>
  <div ref="container" class="cytoscape-renderer" />
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { match } from "ts-pattern";
import cytoscape, {
  Core,
  ElementsDefinition,
  LayoutOptions,
  NodeSingular,
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
import { extendCyPopperElements } from "./cyPopperExtender";
import { diffCyElements } from "./cyDiffer";
import { applyDiff } from "./cyUpdateHelpers";
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

    /**
     * Re-painting the entire graph is an expensive operation.
     * We could slightly optimize it by creating an AST/DAG in a way
     * that allows us to diff across graph copies and only update
     * the affected elements. Doing so for unlabelled DAGs is difficult.
     * https://stackoverflow.com/questions/16553343/diff-for-directed-acyclic-graphs
     * Moreover, layout is the fundamental bottleneck. Running layout on a large
     * graph with just one added node has better performance than running on an
     * entirely new graph but still has a noticeable delay.
     */
    runLayout(): void {
      Promise.resolve().then(() => {
        if (this.cy) {
          this.cy.layout(layoutOptions).run();
        }
      });
    },

    applyThemeStyles(): void {
      if (!this.cy) return;
      const newStylesheets = makeCyStylesheets(this.dag, this.isDark);
      this.cy.style(newStylesheets);
    },

    updateDag(dag: Dag): void {
      if (!this.cy) return;

      const newElements = makeCyElements(dag);
      const newStylesheets = makeCyStylesheets(dag, this.isDark);

      if (!this.previousElements) {
        // First render: full build
        this.cy.add(newElements);
        this.cy.style(newStylesheets);
        extendCyPopperElements(
          this.cy,
          dag,
          this.$refs.container as HTMLElement,
        );
        this.runLayout();
      } else {
        const diff = diffCyElements(this.previousElements, newElements);
        applyDiff(this.cy, diff);

        this.cy.style(newStylesheets);
        extendCyPopperElements(
          this.cy,
          dag,
          this.$refs.container as HTMLElement,
        );

        if (diff.topologyChanged) {
          this.runLayout();
        }
      }

      this.previousElements = newElements;
    },

    export(exportOptions: FileExportOptions): void {
      if (!this.cy) {
        console.error("Cytoscape instance not initialized");
        return;
      }

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
.cytoscape-renderer {
  height: 100%;
  width: 100%;
  background-color: var(--fviz-bg);
  border: solid 1px var(--fviz-border);
  box-sizing: border-box;
}
</style>
