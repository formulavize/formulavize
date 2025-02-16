<template>
  <div id="canvas" ref="canvas" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { match } from "ts-pattern";
import cytoscape from "cytoscape";
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
  name: "GraphView",
  props: {
    curDag: {
      type: Dag,
      default: new Dag(""),
    },
    lockPositions: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      cy: cytoscape(),
    };
  },
  watch: {
    curDag() {
      this.reDrawDag();
    },
  },
  mounted(): void {
    this.cy.autoungrabify(this.lockPositions);
    this.cy.mount(this.$refs.canvas as HTMLElement);
  },
  methods: {
    // Re-painting the entire graph is an expensive operation.
    // We could slightly optimize it by creating an AST/DAG in a way
    // that allows us to diff across graph copies and only update
    // the affected elements. Doing so for unlabelled DAGs is difficult.
    // https://stackoverflow.com/questions/16553343/diff-for-directed-acyclic-graphs
    // Moreover, layout is the fundamental bottleneck. Running layout on a large
    // graph with just one added node has better performance than running on an
    // entirely new graph but still has a noticeable delay.
    reDrawDag() {
      this.cy.elements().remove();
      this.cy.removeAllListeners();

      const newElements = makeCyElements(this.curDag);
      this.cy.add(newElements);

      const newStylesheets = makeCyStylesheets(this.curDag);
      this.cy.style(newStylesheets);

      extendCyPopperElements(
        this.cy,
        this.curDag,
        this.$refs.canvas as HTMLElement,
      );

      Promise.resolve().then(() => {
        this.cy.layout({ name: "dagre" }).run(); // most expensive operation
      });
    },
    exportImage(exportType: ImageExportFormat) {
      // Issue: the svg exporter rasterizes images in the graph.
      // The workaround for exporting large images is to export a scaled up
      // raster image and then downscale it in an image editor.
      // Ideally, this issue should be addressed in the underlying library.
      // Speculatively, we might be able to swap the image tags in the svg.
      const scaleFactor = 1;
      const imgBlob = match(exportType)
        .with(ImageExportFormat.PNG, () => {
          return this.cy.png({
            full: true,
            scale: scaleFactor,
            output: "blob",
          });
        })
        .with(ImageExportFormat.JPG, () => {
          return this.cy.jpg({
            full: true,
            scale: scaleFactor,
            output: "blob",
          });
        })
        .with(ImageExportFormat.SVG, () => {
          // @ts-expect-error: missing types
          const svgData = this.cy.svg({ full: true, scale: scaleFactor });
          return new Blob([svgData], {
            type: "image/svg+xml;charset=utf-8",
          });
        })
        .exhaustive();
      const fileName = this.curDag.Id + "." + exportType;
      saveAs(imgBlob, fileName);
    },
  },
});
</script>

<style scoped>
#canvas {
  height: 100%;
  width: 100%;
  background-color: #fff;
  border: solid 1px #eee;
  box-sizing: border-box;
}
</style>
