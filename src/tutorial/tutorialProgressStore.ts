import { VersionedStore } from "../versionedStore";

interface TutorialProgress {
  highestCompleted: number;
}

const DEFAULTS: TutorialProgress = {
  highestCompleted: -1,
};

// Progress is a single flat puzzlet index, so inserting or reordering a module
// changes what a saved index means. Bump this to discard stale progress.
export const TUTORIAL_PROGRESS_VERSION = 2;

export class TutorialProgressStore extends VersionedStore<TutorialProgress> {
  constructor() {
    super("formulavize-tutorial-progress", TUTORIAL_PROGRESS_VERSION, DEFAULTS);
  }

  getHighestCompletedIndex(): number {
    return this.load().highestCompleted;
  }

  markCompleted(puzzletIndex: number): void {
    const current = this.getHighestCompletedIndex();
    if (puzzletIndex > current) {
      this.save({ highestCompleted: puzzletIndex });
    }
  }

  hasProgress(): boolean {
    return this.getHighestCompletedIndex() >= 0;
  }

  clearProgress(): void {
    this.clear();
  }
}
