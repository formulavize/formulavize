<template>
  <div class="toolbar">
    <img id="logo" src="/assets/formulavize_logo.svg" alt="Formulavize logo" />
    <h1>formulavize</h1>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
export default defineComponent({
  name: "ToolBar",
});
</script>

<style>
.toolbar {
  display: flex;
  align-items: center;
}
#logo {
  height: 2em;
}
</style>
