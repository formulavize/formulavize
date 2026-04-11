<template>
  <div class="toolbar">
    <img id="logo" src="/assets/formulavize_logo.svg" alt="Formulavize logo" />
    <h1>formulavize</h1>
    <v-btn-group density="comfortable">
      <v-btn icon :active="tutorialMode" @click="$emit('tutorial-clicked')">
        <v-icon :icon="mdiSchoolOutline" />
        <v-tooltip activator="parent" text="Tutorial" location="bottom" />
      </v-btn>
      <v-btn icon @click="handleCopySource">
        <v-icon :icon="mdiContentCopy" />
        <v-tooltip
          activator="parent"
          :text="copied ? 'Copied!' : 'Copy Fiz'"
          location="bottom"
          :model-value="copied || undefined"
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
import { defineComponent, ref } from "vue";
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
  emits: ["open-export", "open-options", "copy-source", "tutorial-clicked"],
  setup(_, { emit }) {
    const copied = ref(false);
    let copyTimer: ReturnType<typeof setTimeout> | undefined;

    function handleCopySource() {
      emit("copy-source");
      copied.value = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copied.value = false;
      }, 2000);
    }

    return {
      mdiSchoolOutline,
      mdiContentCopy,
      mdiExport,
      mdiCogOutline,
      mdiGithub,
      copied,
      handleCopySource,
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
