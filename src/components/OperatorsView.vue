<template>
  <h2>Operators</h2>
  <button v-on:click="pushCurOpBundle">
    Dummy Update
  </button>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { OpBundle } from '../common/opBundle'
export default defineComponent({
  name: 'OperatorsView',
  emits: ["update-opbundle"],
  data() {
    return {
      curOpBundle: new OpBundle("")
    }
  },
  methods: {
    pushCurOpBundle() {
      let testBundle = new OpBundle("Test")
      testBundle.addOpDesc({name: "test", imgUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e2/Full_outer_join_symbol.svg"})
      this.curOpBundle = testBundle
      this.$emit("update-opbundle", this.curOpBundle)
    }
  }
})
</script>

<style scoped>
</style>