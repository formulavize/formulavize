<template>
  <div id="canvas" ref="canvas" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import cytoscapePopper from "cytoscape-popper";
import { createPopper } from "@popperjs/core";
import { makeCyElements } from "../compiler/cyGraphFactory";
import { makeCyStylesheets } from "../compiler/cyStyleSheetsFactory";
import { extendCyPopperElements } from "../compiler/cyPopperExtender";
import { Dag } from "../compiler/dag";

cytoscape.use(dagre);
// TODO: Switch popper to floating-ui or tippy
// https://github.com/cytoscape/cytoscape.js-popper?tab=readme-ov-file#usage-with-popperjs-deprecated
// @ts-ignore
cytoscape.use(cytoscapePopper(createPopper));

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

      extendCyPopperElements(this.cy, this.curDag);

      Promise.resolve().then(() => {
        this.cy.layout({ name: "dagre" }).run(); // most expensive operation
      });
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
