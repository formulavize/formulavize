import { Lesson, Puzzlet, SuccessCriterion } from "./lesson";
import { createFizLesson } from "./fiz/lessonPlan";
import { Compilation } from "../compiler/compilation";
import { TutorialProgressStore } from "./tutorialProgressStore";
import { TypingSpeed } from "./animationHelpers";

export class TutorialManager {
  private callbacks: {
    setEditorText: ((text: string) => void) | null;
    setTutorialHeaderText: ((text: string) => void) | null;
    setExamplesText: ((text: string) => void) | null;
    onTutorialComplete: (() => void) | null;
    onLastPuzzletReached: (() => void) | null;
  } = {
    setEditorText: null,
    setTutorialHeaderText: null,
    setExamplesText: null,
    onTutorialComplete: null,
    onLastPuzzletReached: null,
  };

  private isAnimating: boolean = false;
  private animationHandle: number | null = null;
  private currentLesson: Lesson = createFizLesson();
  private isAdvancing: boolean = false;
  private tutorialActive: boolean = false;
  private disableAnimations: boolean = false;
  private progressStore: TutorialProgressStore = new TutorialProgressStore();
  public cachedHighestCompleted: number;
  private staticHeaderText: string = "";
  private latestCriteriaResults: boolean[] = [];

  constructor() {
    this.cachedHighestCompleted = this.progressStore.getHighestCompletedIndex();
  }

  public setCallbacks(
    setEditorText: (text: string) => void,
    setTutorialHeaderText: (text: string) => void,
    setExamplesText: (text: string) => void,
    onTutorialComplete: (() => void) | null = null,
    onLastPuzzletReached: (() => void) | null = null,
  ): void {
    this.callbacks = {
      setEditorText,
      setTutorialHeaderText,
      setExamplesText,
      onTutorialComplete,
      onLastPuzzletReached,
    };
  }

  public setDisableAnimations(disable: boolean): void {
    this.disableAnimations = disable;
  }

  private setEditorText(text: string): void {
    this.callbacks.setEditorText?.(text);
  }

  private setTutorialHeaderText(text: string): void {
    this.callbacks.setTutorialHeaderText?.(text);
  }

  private setExamplesText(text: string): void {
    this.callbacks.setExamplesText?.(text);
  }

  public startTutorialAt(puzzletIndex: number): void {
    if (
      !this.callbacks.setEditorText ||
      !this.callbacks.setTutorialHeaderText ||
      !this.callbacks.setExamplesText
    ) {
      console.warn("Text editor callbacks not set. Cannot start tutorial.");
      return;
    }
    this.currentLesson.jumpTo(puzzletIndex);
    this.tutorialActive = true;
    this.setEditorText("");
    this.animatePuzzlet(this.currentLesson.getCurrentPuzzlet());
  }

  public stopTutorial(): void {
    this.tutorialActive = false;
    this.cancelAnimation();
  }

  private formatChecklist(
    criteria: SuccessCriterion[],
    results: boolean[],
  ): string {
    if (criteria.length === 0) return "";
    return (
      "\n" +
      criteria
        .map((c, i) => {
          const mark = results[i] ? "\u2713" : " ";
          return `[${mark}] ${c.description}`;
        })
        .join("\n")
    );
  }

  private updateChecklistDisplay(): void {
    const puzzlet = this.currentLesson.getCurrentPuzzlet();
    const checklist = this.formatChecklist(
      puzzlet.successCriteria,
      this.latestCriteriaResults,
    );
    this.setTutorialHeaderText(
      "/* " + this.staticHeaderText + checklist + " */\n",
    );
  }

  public async onCompilation(compilation: Compilation): Promise<void> {
    if (!this.tutorialActive || this.isAdvancing) return;

    // Update criteria results and checklist display
    if (!this.isAnimating) {
      this.latestCriteriaResults =
        this.currentLesson.evaluateCriteria(compilation);
      this.updateChecklistDisplay();
    }

    if (!this.currentLesson.canAdvance(compilation)) return;
    this.isAdvancing = true;
    try {
      await this.delay(500); // Small delay before advancing to allow user to see the successful change
      if (!this.tutorialActive) return;
      const completedIndex = this.currentLesson.getCurrentPuzzletIndex();
      this.progressStore.markCompleted(completedIndex);
      this.cachedHighestCompleted =
        this.progressStore.getHighestCompletedIndex();
      this.currentLesson.advance();
      // Exit tutorial mode when the lesson is complete
      if (this.currentLesson.isComplete()) {
        this.stopTutorial();
        this.callbacks.onTutorialComplete?.();
        return;
      }
      const nextPuzzlet = this.currentLesson.getCurrentPuzzlet();
      this.animatePuzzlet(nextPuzzlet);
    } finally {
      this.isAdvancing = false;
    }
  }

  private getProgressString(): string {
    const lessonName = this.currentLesson.Name;
    const moduleName = this.currentLesson.getCurrentModule().name;
    const puzzletName = this.currentLesson.getCurrentPuzzlet().name;
    const curIdx = this.currentLesson.getCurrentPuzzletIndex();
    const numPuzzlets = this.currentLesson.getNumPuzzlets();
    return `${lessonName} (${curIdx + 1}/${numPuzzlets}) - ${moduleName}: ${puzzletName}\n`;
  }

  private async animatePuzzlet(puzzlet: Puzzlet): Promise<void> {
    this.cancelAnimation(); // Prevent overlapping animations
    this.isAnimating = true;

    // Check if this is the last puzzlet and trigger callback
    const isLastPuzzlet =
      this.currentLesson.getCurrentPuzzletIndex() ===
      this.currentLesson.getNumPuzzlets() - 1;
    if (isLastPuzzlet) {
      this.callbacks.onLastPuzzletReached?.();
    }

    if (puzzlet.clearEditorOnStart) {
      this.setEditorText("");
    }

    let headerText = this.getProgressString();
    this.latestCriteriaResults = new Array(puzzlet.successCriteria.length).fill(
      false,
    );

    // If animations are disabled, show all text immediately
    if (this.disableAnimations) {
      headerText += puzzlet.instructions.map((step) => step.text).join("");
      this.staticHeaderText = headerText;
      this.updateChecklistDisplay();

      const examplesText = puzzlet.examples.map((step) => step.text).join("");
      this.setExamplesText(examplesText + "\n");
      this.isAnimating = false;
      return;
    }

    this.setTutorialHeaderText(headerText);

    // Animate all instructions in the header
    for (const step of puzzlet.instructions) {
      for (const char of step.text) {
        if (!this.isAnimating) break;
        headerText += char;
        this.setTutorialHeaderText("/* " + headerText + " */\n");
        await this.delay(step.typingSpeedDelayMs);
      }
    }

    // Store static header and animate the initial checklist
    this.staticHeaderText = headerText;
    const checklistText = this.formatChecklist(
      puzzlet.successCriteria,
      this.latestCriteriaResults,
    );
    let animatedChecklist = "";
    for (const char of checklistText) {
      if (!this.isAnimating) break;
      animatedChecklist += char;
      this.setTutorialHeaderText(
        "/* " + this.staticHeaderText + animatedChecklist + " */\n",
      );
      await this.delay(TypingSpeed.Fast);
    }

    // Animate all examples at the header boundary (all are editable)
    let examplesText = "";
    for (const step of puzzlet.examples) {
      for (const char of step.text) {
        if (!this.isAnimating) break;
        examplesText += char;
        this.setExamplesText(examplesText + "\n");
        await this.delay(step.typingSpeedDelayMs);
      }
    }
    this.isAnimating = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.animationHandle = window.setTimeout(resolve, ms);
    });
  }

  private cancelAnimation(): void {
    this.isAnimating = false;
    if (this.animationHandle !== null) {
      clearTimeout(this.animationHandle);
      this.animationHandle = null;
    }
  }

  public hasProgress(): boolean {
    return this.cachedHighestCompleted >= 0;
  }

  public getHighestCompletedIndex(): number {
    return this.cachedHighestCompleted;
  }

  public getLesson(): Lesson {
    return this.currentLesson;
  }

  public clearProgress(): void {
    this.progressStore.clearProgress();
    this.cachedHighestCompleted = -1;
  }
}
