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
      let nodeList = dag.getNodeList().map((node) => {
        return { 
          data: {
            id: node.id,
            label: node.name
          }
        }
      })
      let edgeList = dag.getEdgeList().map((edge) => {
        return {
          data: {
            id: edge.id,
            source: edge.srcNodeId,
            target: edge.destNodeId
          }
        }
      })
      this.cy.elements().remove()
      this.cy.add({ nodes: nodeList, edges: edgeList })
      this.cy.layout({ name: 'dagre' }).run()
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