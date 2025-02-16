<template>
  <div class="toolbar">
    <img id="logo" src="/assets/formulavize_logo.svg" alt="Formulavize logo" />
    <h1>formulavize</h1>
    <v-btn-group density="comfortable">
      <v-btn icon>
        <v-icon :icon="mdiExport"></v-icon>
        <v-tooltip activator="parent" text="Export" location="bottom" />
        <v-menu activator="parent">
          <v-list>
            <v-list-item @click="emitExportPngEvent">
              <v-list-item-title>Export as PNG</v-list-item-title>
            </v-list-item>
            <v-list-item @click="emitExportJpgEvent">
              <v-list-item-title>Export as JPG</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-btn>
      <v-btn icon :active="debugMode" @click="emitToggleDebugModeEvent">
        <v-icon :icon="mdiApplicationParenthesesOutline"></v-icon>
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
        <v-icon :icon="mdiGithub"></v-icon>
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
import { ImageExportFormat } from "../compiler/constants";
export default defineComponent({
  name: "ToolBar",
  props: {
    debugMode: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-debug-mode", "export"],
  data() {
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
    emitExportPngEvent() {
      this.$emit("export", ImageExportFormat.PNG);
    },
    emitExportJpgEvent() {
      this.$emit("export", ImageExportFormat.JPG);
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
