<template>
  <div id="canvas" ref="canvas">
    <component
      :is="rendererComponent"
      v-if="rendererComponent"
      ref="renderer"
      :dag="curDag"
      :is-dark="isDark"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { Dag } from "../compiler/dag";
import {
  FileExportOptions,
  RendererComponent,
  IRenderer,
} from "../rendererApi";

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
    // Absent only when no renderer is registered at all; the canvas then
    // stays empty rather than the app failing to mount.
    rendererComponent: {
      type: Object as PropType<RendererComponent>,
      default: undefined,
    },
    isDark: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    /**
     * Export the current visualization as a file.
     * This method delegates to the renderer's export implementation.
     */
    export(exportOptions: FileExportOptions): void {
      const renderer = this.$refs.renderer as IRenderer;
      renderer?.export?.(exportOptions);
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
