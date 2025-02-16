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
import { makeCyElements } from "../compiler/cyGraphFactory";
import { makeCyStylesheets } from "../compiler/cyStyleSheetsFactory";
import { extendCyPopperElements } from "../compiler/cyPopperExtender";
import { Dag } from "../compiler/dag";
import { ImageExportFormat } from "../compiler/constants";

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

export default defineComponent({
  name: "GraphView",
  props: {
    curDag: {
      type: Dag,
      default: new Dag(""),
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
    this.cy.autoungrabify(true);
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
      const imgData = match(exportType)
        .with(ImageExportFormat.PNG, () => this.cy.png({ full: true }))
        .with(ImageExportFormat.JPG, () => this.cy.jpg({ full: true }))
        .exhaustive();
      const a = document.createElement("a");
      a.href = imgData;
      a.download = this.curDag.Id + "." + exportType;
      a.click();
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
