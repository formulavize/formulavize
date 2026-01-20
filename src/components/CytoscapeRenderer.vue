<template>
  <div ref="container" class="cytoscape-renderer" />
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { match } from "ts-pattern";
import cytoscape, { Core } from "cytoscape";
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
import { makeCyElements } from "../compiler/cyGraphFactory";
import { makeCyStylesheets } from "../compiler/cyStyleSheetsFactory";
import { extendCyPopperElements } from "../compiler/cyPopperExtender";
import { Dag } from "../compiler/dag";
import { ImageExportFormat } from "../compiler/constants";
import { saveAs } from "file-saver";
import { IRenderer, ImageExportOptions } from "./rendererTypes";

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

export default defineComponent({
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
  },
  data() {
    return {
      cy: null as Core | null,
    };
  },
  watch: {
    dag() {
      this.updateDag(this.dag);
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
    updateDag(dag: Dag): void {
      if (!this.cy) return;

      this.cy.elements().remove();
      this.cy.removeAllListeners();

      const newElements = makeCyElements(dag);
      this.cy.add(newElements);

      const newStylesheets = makeCyStylesheets(dag);
      this.cy.style(newStylesheets);

      extendCyPopperElements(this.cy, dag, this.$refs.container as HTMLElement);

      Promise.resolve().then(() => {
        if (this.cy) {
          this.cy.layout({ name: "dagre" }).run(); // most expensive operation
        }
      });
    },

    exportImage(exportOptions: ImageExportOptions): void {
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
        .with(ImageExportFormat.PNG, () => {
          return this.cy!.png({
            full: true,
            scale: scaleFactor,
            output: "blob",
          });
        })
        .with(ImageExportFormat.JPG, () => {
          return this.cy!.jpg({
            full: true,
            scale: scaleFactor,
            output: "blob",
          });
        })
        .with(ImageExportFormat.SVG, () => {
          // @ts-expect-error: missing types
          const svgData = this.cy!.svg({ full: true, scale: scaleFactor });
          return new Blob([svgData], {
            type: "image/svg+xml;charset=utf-8",
          });
        })
        .exhaustive();
      const fileName = exportOptions.fileName + "." + exportOptions.fileType;
      saveAs(imgBlob, fileName);
    },
  },
});

// Export type assertion helper for IRenderer interface
export type CytoscapeRendererType = IRenderer;
</script>

<style scoped>
.cytoscape-renderer {
  height: 100%;
  width: 100%;
  background-color: #fff;
  border: solid 1px #eee;
  box-sizing: border-box;
}
</style>
