<template>
  <v-dialog
    :model-value="showExport"
    persistent
    max-width="600px"
    @update:model-value="$emit('update:showExport', $event)"
  >
    <v-card class="pa-4">
      <v-card-title class="d-flex align-center">
        <v-icon :icon="mdiExport" class="mr-2" />
        <span>Export</span>
      </v-card-title>
      <v-card-text>
        <v-form ref="exportForm" validate-on="eager">
          <v-container class="pa-0">
            <v-row justify="center">
              <v-col cols="6">
                <v-text-field
                  v-model="fileName"
                  label="File Name"
                  :rules="fileNameRules"
                  clearable
                />
              </v-col>
              <v-col cols="3">
                <v-select
                  v-model="fileType"
                  :items="formatOptions"
                  label="File Type"
                  :rules="fileTypeRules"
                ></v-select>
              </v-col>
              <v-col cols="3">
                <v-text-field
                  v-model="scalingPct"
                  label="Image Scaling (%)"
                  suffix="%"
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  :rules="scalingRules"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-container>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn :disabled="!isFormValid" @click="exportFile">
          <v-icon :icon="mdiDownload" class="mr-1" />
          <span>Download</span>
        </v-btn>
        <v-btn @click="$emit('update:showExport', false)">
          <v-icon :icon="mdiCloseCircleOutline" class="mr-1" />
          <span>Close</span>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { mdiExport, mdiCloseCircleOutline, mdiDownload } from "@mdi/js";
import { ExportFormat } from "../compiler/constants";
import { VForm } from "vuetify/components";

const fileNameRules = [
  (fileName: string) => !!fileName || "File name is required",
  (fileName: string) =>
    fileName.length < 256 || "File name must be less than 256 characters",
];
const fileTypeRules = [
  (fileType: string) => !!fileType || "File type is required",
];
const scalingRules = [
  (scalingPct: number) => !!scalingPct || "Scaling percentage is required",
  (scalingPct: number) =>
    scalingPct > 0 || "Scaling percentage must be greater than 0",
  (scalingPct: number) =>
    scalingPct <= 10000 ||
    "Scaling percentage must be less than or equal to 10000",
];

export default defineComponent({
  name: "ExportOptionsPopup",
  props: {
    showExport: {
      type: Boolean,
      required: true,
    },
  },
  emits: ["update:showExport", "export-with-options"],
  setup() {
    const exportForm = ref<InstanceType<typeof VForm> | null>(null);
    return {
      exportForm,
      fileNameRules,
      fileTypeRules,
      scalingRules,
      mdiExport,
      mdiCloseCircleOutline,
      mdiDownload,
    };
  },
  data() {
    return {
      formatOptions: Object.values(ExportFormat),
      fileName: "formulavize",
      fileType: ExportFormat.PNG,
      scalingPct: 100,
    };
  },
  computed: {
    isFormValid() {
      return this.exportForm?.isValid ?? false;
    },
  },
  methods: {
    exportFile() {
      if (!this.isFormValid) return;
      const exportOptions = {
        fileName: this.fileName,
        fileType: this.fileType,
        scalingFactor: this.scalingPct / 100,
      };
      this.$emit("export-with-options", exportOptions);
    },
  },
});
</script>
