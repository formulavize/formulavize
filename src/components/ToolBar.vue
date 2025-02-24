<template>
  <div class="toolbar">
    <img id="logo" src="/assets/formulavize_logo.svg" alt="Formulavize logo" />
    <h1>formulavize</h1>
    <v-btn-group density="comfortable">
      <v-btn icon @click="emitExportEvent">
        <v-icon :icon="mdiExport" />
        <v-tooltip activator="parent" text="Export" location="bottom" />
      </v-btn>
      <v-btn icon :active="debugMode" @click="emitToggleDebugModeEvent">
        <v-icon :icon="mdiApplicationParenthesesOutline" />
        <v-tooltip
          activator="parent"
          text="Toggle Debug Mode"
          location="bottom"
        />
      </v-btn>
      <v-btn
        icon
        href="https://github.com/formulavize/formulavize"
        target="_blank"
      >
        <v-icon :icon="mdiGithub" />
        <v-tooltip activator="parent" text="View on GitHub" location="bottom" />
      </v-btn>
    </v-btn-group>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  mdiExport,
  mdiApplicationParenthesesOutline,
  mdiGithub,
} from "@mdi/js";
export default defineComponent({
  name: "ToolBar",
  props: {
    debugMode: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-debug-mode", "export-initiated"],
  setup() {
    return {
      mdiExport,
      mdiApplicationParenthesesOutline,
      mdiGithub,
    };
  },
  methods: {
    emitToggleDebugModeEvent() {
      this.$emit("toggle-debug-mode");
    },
    emitExportEvent() {
      this.$emit("export-initiated");
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
