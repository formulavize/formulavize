<template>
  <div id="canvas" ref="canvas">
    <component :is="rendererComponent" ref="renderer" :dag="curDag" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { Dag } from "../compiler/dag";
import {
  IRenderer,
  ImageExportOptions,
  RendererComponent,
} from "../compiler/rendererTypes";
import CytoscapeRenderer from "../renderers/cyDag/CytoscapeRenderer.vue";

// GraphView - Component for rendering the DAG visualization
// Uses a pluggable renderer component to display the graph enabling flexibility
// in rendering strategies
export default defineComponent({
  name: "GraphView",
  props: {
    curDag: {
      type: Object as PropType<Dag>,
      default: () => new Dag(""),
    },
    rendererComponent: {
      type: Object as PropType<RendererComponent & IRenderer>,
      default: () => CytoscapeRenderer,
    },
  },
  methods: {
    /**
     * Export the current visualization as an image.
     * This method delegates to the renderer's exportImage implementation.
     */
    exportImage(exportOptions: ImageExportOptions): void {
      const renderer = this.$refs.renderer as IRenderer;
      if (renderer && typeof renderer.exportImage === "function") {
        renderer.exportImage(exportOptions);
      } else {
        console.error("Renderer does not support image export");
      }
    },
  },
});
</script>

<style scoped>
#canvas {
  height: 100%;
  width: 100%;
}
</style>
