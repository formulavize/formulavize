<template>
  <div id="canvas" ref="canvas" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import cytoscape from 'cytoscape'
import { Dag } from '../common/dag'
//@ts-ignore
import dagre from 'cytoscape-dagre'

cytoscape.use(dagre)

export default defineComponent({
  name: 'GraphView',
  props: {
    curDag: Dag
  },
  data() {
    return {
      cy: cytoscape({
        style: [
          { selector: "node[label]", style: {"label": "data(label)"} },
          { selector: "edge",
            style: {
              "curve-style": "bezier",
              "target-arrow-shape": "triangle"
            }
          }
        ]
      })
    }
  },
  watch: {
    curDag(newVal, _) {
      this.reDrawDag(newVal)
    }
  },
  methods: {
    reDrawDag(dag: Dag) {
      console.log(dag.formatDag())
      this.cy.remove("*")
      for (let node of dag.getNodeList()) {
        this.cy.add({
          group: 'nodes',
          data: {
            id: node.id,
            label: node.name
          },
        })
      }
      for (let edge of dag.getEdgeList()) {
        this.cy.add({
          group: 'edges',
          data: {
            id: edge.id,
            source: edge.srcNodeId,
            target: edge.destNodeId
          },
        })
      }
      this.cy.layout({name: 'dagre'}).run()
    }
  },
  mounted(): void {
    this.cy.mount(this.$refs.canvas as HTMLElement)
  },
})
</script>

<style scoped>
#canvas {
  height: 100%;
  width: 100%;
}
</style>