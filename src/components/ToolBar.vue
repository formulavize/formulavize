<template>
  <div class="toolbar">
    <img id="logo" src="/assets/formulavize_logo.svg" alt="Formulavize logo" />
    <h1>formulavize</h1>
    <v-btn
      icon
      density="comfortable"
      :active="debugMode"
      @click="emitToggleDebugModeEvent"
    >
      <v-icon :icon="mdiApplicationParenthesesOutline"></v-icon>
      <v-tooltip
        activator="parent"
        text="Toggle Debug Mode"
        location="bottom"
      />
    </v-btn>
    <v-btn
      icon
      density="comfortable"
      href="https://github.com/formulavize/formulavize"
      target="_blank"
    >
      <v-icon :icon="mdiGithub"></v-icon>
      <v-tooltip activator="parent" text="View on GitHub" location="bottom" />
    </v-btn>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mdiGithub, mdiApplicationParenthesesOutline } from "@mdi/js";
export default defineComponent({
  name: "ToolBar",
  props: {
    debugMode: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-debug-mode"],
  data() {
    return {
      mdiApplicationParenthesesOutline,
      mdiGithub,
    };
  },
  methods: {
    emitToggleDebugModeEvent() {
      this.$emit("toggle-debug-mode");
    },
  },
});
</script>

<style>
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 1em;
}
#logo {
  height: 2em;
}
</style>
