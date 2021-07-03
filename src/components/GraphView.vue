<template>
  <div id="canvas" ref="canvas" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import cytoscape from 'cytoscape'

export default defineComponent({
  name: 'GraphView',
  mounted(): void {
    var cy = cytoscape({container: this.$refs.canvas as HTMLElement})
    cy.add({
      group: 'nodes',
      data: { weight: 10 },
      position: { x: 20, y: 20 }
    })
    cy.resize()
  },
})
</script>

<style scoped>
#canvas {
  height: 100%;
  width: 100%;
}
</style>