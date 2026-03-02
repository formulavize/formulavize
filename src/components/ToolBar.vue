<template>
  <div class="toolbar">
    <img id="logo" src="/assets/formulavize_logo.svg" alt="Formulavize logo" />
    <h1>formulavize</h1>
    <v-btn-group density="comfortable">
      <v-btn-toggle v-model="tutorialModeModel" density="comfortable">
        <v-btn value="tutorial" icon>
          <v-icon :icon="mdiSchoolOutline" />
          <v-tooltip activator="parent" text="Tutorial" location="bottom" />
        </v-btn>
      </v-btn-toggle>
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
      <v-btn
        icon
        href="https://github.com/formulavize/formulavize"
        target="_blank"
      >
        <v-icon :icon="mdiGithub" />
        <v-tooltip
          activator="parent"
          text="View Project GitHub"
          location="bottom"
        />
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
  mdiSchoolOutline,
  mdiContentCopy,
  mdiExport,
  mdiGithub,
  mdiCogOutline,
} from "@mdi/js";
export default defineComponent({
  name: "ToolBar",
  props: {
    tutorialMode: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["open-export", "open-options", "copy-source", "update:tutorialMode"],
  setup() {
    return {
      mdiSchoolOutline,
      mdiContentCopy,
      mdiExport,
      mdiCogOutline,
      mdiGithub,
    };
  },
  computed: {
    tutorialModeModel: {
      get(): string | undefined {
        return this.tutorialMode ? "tutorial" : undefined;
      },
      set(value: string | undefined) {
        this.$emit("update:tutorialMode", value === "tutorial");
      },
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
