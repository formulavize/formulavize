import { VersionedStore } from "../versionedStore";

interface TutorialProgress {
  highestCompleted: number;
}

const DEFAULTS: TutorialProgress = {
  highestCompleted: -1,
};

export class TutorialProgressStore extends VersionedStore<TutorialProgress> {
  constructor() {
    super("formulavize-tutorial-progress", 1, DEFAULTS);
  }

  protected extract(
    parsed: { version: number } & TutorialProgress,
  ): TutorialProgress {
    return { highestCompleted: parsed.highestCompleted };
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
