<template>
  <div
    ref="container"
    class="minimal-example-renderer"
    :class="{ 'dark-mode': isDark }"
  >
    <div class="stats">
      <h3>Basic DAG Statistics</h3>
      <ul>
        <li>Node Count: {{ nodeCount }}</li>
        <li>Edge Count: {{ edgeCount }}</li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { Dag } from "../../compiler/dag";
import {
  RendererComponent,
  FileExportOptions,
} from "../../compiler/rendererTypes";
import { ExportFormat } from "../../compiler/constants";
import { saveAs } from "file-saver";

/**
 * MinimalExampleRenderer - A minimal example renderer to demonstrate renderer structure.
 * This renderer displays basic DAG statistics.
 */
const MinimalExampleRenderer = defineComponent({
  name: "MinimalExampleRenderer",
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
  computed: {
    nodeCount(): number {
      return this.dag.getNodeList().length;
    },
    edgeCount(): number {
      return this.dag.getEdgeList().length;
    },
  },
  watch: {
    dag() {
      this.updateDag(this.dag);
    },
  },
  methods: {
    updateDag(dag: Dag): void {
      // For this simple renderer, Vue's reactivity handles updates automatically
      // More complex renderers would need to update their visualization here
      console.log("MinimalExampleRenderer: DAG updated", {
        nodes: dag.getNodeList().length,
        edges: dag.getEdgeList().length,
      });
    },

    export(exportOptions: FileExportOptions): void {
      if (exportOptions.fileType !== ExportFormat.TXT) {
        console.error(
          `MinimalExampleRenderer: Unsupported export format "${exportOptions.fileType}". Only TXT is supported.`,
        );
        return;
      }

      const content = `
Basic DAG Statistics
--------------------
Node Count: ${this.nodeCount}
Edge Count: ${this.edgeCount}
      `.trim();

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `${exportOptions.fileName}.txt`);
    },
  },
});

export default Object.assign(MinimalExampleRenderer, {
  displayName: "Minimal Example Renderer",
  supportedExportFormats: [ExportFormat.TXT],
}) as RendererComponent;
</script>

<style scoped>
.minimal-example-renderer {
  height: 100%;
  width: 100%;
  background-color: #f9f9f9;
  border: solid 1px #ddd;
  box-sizing: border-box;
  padding: 20px;
  overflow: auto;
}

.minimal-example-renderer.dark-mode {
  background-color: #0d0d0d;
  border-color: #2a2a2a;
}

.stats {
  margin-bottom: 20px;
  padding: 15px;
  border-radius: 4px;
  background-color: #ffffff;
}

.minimal-example-renderer.dark-mode .stats {
  background-color: #1a1a1a;
}

.stats h3 {
  margin-top: 0;
  color: #333333;
}

.minimal-example-renderer.dark-mode .stats h3 {
  color: #ffffff;
}

.stats ul {
  list-style: none;
  padding-left: 0;
}

.stats li {
  padding: 5px 0;
  color: #666666;
}

.minimal-example-renderer.dark-mode .stats li {
  color: #d0d0d0;
}
</style>
