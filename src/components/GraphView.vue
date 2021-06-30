<template>
  <div ref="canvas" />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import cytoscape from 'cytoscape'

export default defineComponent({
  name: 'GraphView',
  mounted(): void {
    var cy = cytoscape({container: this.$refs.canvas as HTMLElement})
    console.log(cy.destroyed())
  },
})
</script>