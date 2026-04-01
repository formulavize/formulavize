<template>
  <v-dialog
    :model-value="showDialog"
    persistent
    max-width="500px"
    @update:model-value="$emit('update:showDialog', $event)"
  >
    <v-card class="pa-4">
      <v-card-title class="d-flex align-center">
        <v-icon :icon="mdiSchoolOutline" class="mr-1" />
        <span>Tutorial - Select Level</span>
      </v-card-title>
      <v-card-text class="py-2">
        <v-expansion-panels variant="accordion">
          <v-expansion-panel
            v-for="(module, moduleIdx) in modules"
            :key="moduleIdx"
          >
            <v-expansion-panel-title>
              <div class="d-flex align-center justify-space-between w-100">
                <span>{{ module.name }}</span>
                <v-chip size="small" class="ml-2">
                  {{ getModuleCompletedCount(moduleIdx) }}/{{
                    module.puzzlets.length
                  }}
                </v-chip>
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-list density="compact">
                <v-list-item
                  v-for="(puzzlet, puzzletIdx) in module.puzzlets"
                  :key="puzzletIdx"
                  :disabled="!isPuzzletSelectable(moduleIdx, puzzletIdx)"
                  :class="{
                    'bg-blue-lighten-5':
                      getFlatIndex(moduleIdx, puzzletIdx) === resumeIndex,
                  }"
                  @click="onPuzzletClick(moduleIdx, puzzletIdx)"
                >
                  <template #prepend>
                    <v-icon
                      :icon="
                        isPuzzletCompleted(moduleIdx, puzzletIdx)
                          ? mdiCheckCircle
                          : mdiCircleOutline
                      "
                      :color="
                        isPuzzletCompleted(moduleIdx, puzzletIdx)
                          ? 'green'
                          : 'grey'
                      "
                      size="small"
                    />
                  </template>
                  <v-list-item-title>{{ puzzlet.name }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="$emit('restart-tutorial')">
          <v-icon :icon="mdiRestart" class="mr-1" />
          <span>Reset Progress</span>
        </v-btn>
        <v-spacer />
        <v-btn @click="$emit('update:showDialog', false)">
          <v-icon :icon="mdiCloseCircleOutline" class="mr-1" />
          <span>Close</span>
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import {
  mdiSchoolOutline,
  mdiCheckCircle,
  mdiCircleOutline,
  mdiCloseCircleOutline,
  mdiRestart,
} from "@mdi/js";
import { LudicModule } from "../tutorial/lesson";

export default defineComponent({
  name: "TutorialLevelSelect",
  props: {
    showDialog: {
      type: Boolean,
      required: true,
    },
    modules: {
      type: Array as PropType<readonly LudicModule[]>,
      required: true,
    },
    highestCompletedIndex: {
      type: Number,
      required: true,
    },
    moduleStartIndices: {
      type: Array as PropType<number[]>,
      required: true,
    },
  },
  emits: ["update:showDialog", "select-puzzlet", "restart-tutorial"],
  setup() {
    return {
      mdiSchoolOutline,
      mdiCheckCircle,
      mdiCircleOutline,
      mdiCloseCircleOutline,
      mdiRestart,
    };
  },
  computed: {
    resumeIndex(): number {
      return this.highestCompletedIndex + 1;
    },
  },
  methods: {
    getFlatIndex(moduleIdx: number, puzzletIdx: number): number {
      return this.moduleStartIndices[moduleIdx] + puzzletIdx;
    },
    isPuzzletCompleted(moduleIdx: number, puzzletIdx: number): boolean {
      return (
        this.getFlatIndex(moduleIdx, puzzletIdx) <= this.highestCompletedIndex
      );
    },
    isPuzzletSelectable(moduleIdx: number, puzzletIdx: number): boolean {
      const flatIdx = this.getFlatIndex(moduleIdx, puzzletIdx);
      return flatIdx <= this.highestCompletedIndex + 1;
    },
    getModuleCompletedCount(moduleIdx: number): number {
      const module = this.modules[moduleIdx];
      let count = 0;
      for (let i = 0; i < module.puzzlets.length; i++) {
        if (this.isPuzzletCompleted(moduleIdx, i)) {
          count++;
        }
      }
      return count;
    },
    onPuzzletClick(moduleIdx: number, puzzletIdx: number): void {
      if (!this.isPuzzletSelectable(moduleIdx, puzzletIdx)) return;
      this.$emit("select-puzzlet", this.getFlatIndex(moduleIdx, puzzletIdx));
    },
  },
});
</script>

<style scoped>
.w-100 {
  width: 100%;
}
</style>
