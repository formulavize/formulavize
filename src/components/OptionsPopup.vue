<template>
  <v-dialog
    :model-value="showOptions"
    persistent
    max-width="400px"
    @update:model-value="$emit('update:showOptions', $event)"
  >
    <v-card class="pa-4">
      <v-card-title class="d-flex align-center">
        <v-icon :icon="mdiCogOutline" class="mr-1" />
        <span>Options</span>
      </v-card-title>
      <v-card-text class="py-1">
        <div>
          <v-checkbox
            label="Tab to Indent"
            hide-details
            :model-value="tabToIndent"
            @update:model-value="$emit('update:tabToIndent', $event)"
          />
          <v-tooltip
            activator="parent"
            :model-value="tabToIndent"
            :open-on-hover="false"
            location="start"
            text="Press Esc to ignore next Tab indent"
          />
        </div>
        <v-checkbox
          label="Debug Mode"
          hide-details="auto"
          :model-value="debugMode"
          @update:model-value="$emit('update:debugMode', $event)"
        />
        <v-select
          label="Theme"
          hide-details="auto"
          :model-value="themeMode"
          :items="[
            { title: 'Light', value: 'light' },
            { title: 'Dark', value: 'dark' },
            { title: 'System', value: 'system' },
          ]"
          @update:model-value="$emit('update:themeMode', $event)"
        />
        <v-select
          label="Renderer"
          hide-details="auto"
          :model-value="selectedRenderer"
          :items="
            rendererOptions.map((opt) => ({
              title: opt.name,
              value: opt.id,
            }))
          "
          @update:model-value="$emit('update:selectedRenderer', $event)"
        />
      </v-card-text>
      <v-card-actions>
        <v-btn @click="$emit('update:showOptions', false)">
          <v-icon :icon="mdiCloseCircleOutline" class="mr-1" />
          <span>Close</span>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { mdiCloseCircleOutline, mdiCogOutline } from "@mdi/js";
export default defineComponent({
  name: "OptionsPopup",
  props: {
    showOptions: {
      type: Boolean,
      required: true,
    },
    tabToIndent: {
      type: Boolean,
      required: true,
    },
    debugMode: {
      type: Boolean,
      required: true,
    },
    themeMode: {
      type: String,
      required: true,
    },
    selectedRenderer: {
      type: String,
      required: true,
    },
    rendererOptions: {
      type: Array as PropType<Array<{ id: string; name: string }>>,
      required: true,
    },
  },
  emits: [
    "update:showOptions",
    "update:tabToIndent",
    "update:debugMode",
    "update:themeMode",
    "update:selectedRenderer",
  ],
  setup() {
    return {
      mdiCloseCircleOutline,
      mdiCogOutline,
    };
  },
});
</script>
