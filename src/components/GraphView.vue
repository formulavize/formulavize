<template>
  <div id="canvas" ref="canvas" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import cytoscape from 'cytoscape'
import { Dag } from '../common/dag'
import { OpBundle } from '../common/opBundle'
//@ts-ignore
import dagre from 'cytoscape-dagre'

cytoscape.use(dagre)

export default defineComponent({
  name: 'GraphView',
  props: {
    curDag: {
      type: Dag,
      default: new Dag(),
    },
    curOpBundle: {
      type: OpBundle,
      default: new OpBundle("")
    }
  },
  data() {
    return {
      cy: cytoscape({
        style: [
          { selector: "node[label]",
            style: {
              "label": "data(label)",
              "text-valign": "bottom",
            }
          },
          { selector: "node[img]",
            style: {
              "background-image": "data(img)",
              "background-fit": "contain"
            }
          },
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
    curDag() {
      this.reDrawDag()
    },
    curOpBundle() {
      this.reDrawDag()
    }
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
      let curOps = this.curOpBundle.Operators
      let nodeList = this.curDag.getNodeList().map((node) => {
        return { 
          data: {
            id: node.id,
            label: node.name,
            img: curOps.get(node.name)?.imgUrl
          }
        }
      })
      let edgeList = this.curDag.getEdgeList().map((edge) => {
        return {
          data: {
            id: edge.id,
            source: edge.srcNodeId,
            target: edge.destNodeId
          }
        }
      })
      let newElements = { nodes: nodeList, edges: edgeList }
      this.cy.elements().remove()
      this.cy.add(newElements)
      Promise.resolve().then(() => {
        this.cy.layout({ name: 'dagre' }).run() // most expensive operation
      })
    }
  },
  mounted(): void {
    this.cy.autoungrabify(true)
    this.cy.mount(this.$refs.canvas as HTMLElement)
  },
})
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