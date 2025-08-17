<template>
  <div class="toolbar">
    <img id="logo" src="/assets/formulavize_logo.svg" alt="Formulavize logo" />
    <h1>formulavize</h1>
    <v-btn-group density="comfortable">
      <v-btn icon @click="$emit('copy-source')">
        <v-icon :icon="mdiContentCopy" />
        <v-tooltip
          activator="parent"
          text="Copy Code to Clipboard"
          location="bottom"
        />
      </v-btn>
      <v-btn icon @click="$emit('open-export')">
        <v-icon :icon="mdiExport" />
        <v-tooltip activator="parent" text="Export Image" location="bottom" />
      </v-btn>
      <v-btn icon :active="debugMode" @click="$emit('toggle-debug-mode')">
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
      <v-btn icon @click="$emit('open-options')">
        <v-icon :icon="mdiCogOutline" />
        <v-tooltip activator="parent" text="Options" location="bottom" />
      </v-btn>
    </v-btn-group>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import {
  mdiContentCopy,
  mdiExport,
  mdiApplicationParenthesesOutline,
  mdiGithub,
  mdiCogOutline,
} from "@mdi/js";
export default defineComponent({
  name: "ToolBar",
  props: {
    debugMode: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-debug-mode", "open-export", "open-options", "copy-source"],
  setup() {
    return {
      mdiContentCopy,
      mdiExport,
      mdiApplicationParenthesesOutline,
      mdiCogOutline,
      mdiGithub,
    };
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
