interface StoredProgress {
  version: number;
  highestCompleted: number;
}

export class TutorialProgressStore {
  private static readonly STORAGE_KEY = "formulavize-tutorial-progress";
  private static readonly VERSION = 1;

  getHighestCompletedIndex(): number {
    const data = this.load();
    return data ? data.highestCompleted : -1;
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
    try {
      localStorage.removeItem(TutorialProgressStore.STORAGE_KEY);
    } catch {
      console.warn("Unable to clear tutorial progress from localStorage");
    }
  }

  private load(): StoredProgress | null {
    try {
      const raw = localStorage.getItem(TutorialProgressStore.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredProgress;
      if (parsed.version !== TutorialProgressStore.VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private save(data: Omit<StoredProgress, "version">): void {
    try {
      localStorage.setItem(
        TutorialProgressStore.STORAGE_KEY,
        JSON.stringify({
          version: TutorialProgressStore.VERSION,
          ...data,
        }),
      );
    } catch {
      console.warn("Unable to save tutorial progress to localStorage");
    }
  }
}
