<template>
  <div id="canvas" ref="canvas" />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import popper from "cytoscape-popper";
import { makeCyElements, makeCyStylesheets } from "../common/cyGraphFactory";
import { extendCyPopperElements } from "../common/cyPopperExtender";
import { Dag } from "../common/dag";
import { TOP_LEVEL_DAG_ID } from "../common/constants";

cytoscape.use(dagre);
cytoscape.use(popper);

export default defineComponent({
  name: "GraphView",
  props: {
    curDag: {
      type: Dag,
      default: new Dag(TOP_LEVEL_DAG_ID),
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
