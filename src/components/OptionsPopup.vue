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
      <v-card-text class="py-2">
        <v-row>
          <v-col cols="12" class="py-1">
            <v-checkbox
              label="Tab to Indent"
              :model-value="tabToIndent"
              @update:model-value="$emit('update:tabToIndent', $event)"
            />
          </v-col>
        </v-row>
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
import { defineComponent } from "vue";
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
  },
  emits: ["update:showOptions", "update:tabToIndent"],
  setup() {
    return {
      mdiCloseCircleOutline,
      mdiCogOutline,
    };
  },
});
</script>
