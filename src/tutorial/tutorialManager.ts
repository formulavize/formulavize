import { Lesson, Puzzlet } from "./lesson";
import { createFizLesson } from "./fiz/lessonPlan";
import { Compilation } from "../compiler/compilation";

export class TutorialManager {
  private callbacks: {
    setEditorText: ((text: string) => void) | null;
    setTutorialHeaderText: ((text: string) => void) | null;
    setExamplesText: ((text: string) => void) | null;
    onTutorialComplete: (() => void) | null;
  } = {
    setEditorText: null,
    setTutorialHeaderText: null,
    setExamplesText: null,
    onTutorialComplete: null,
  };

  private isAnimating: boolean = false;
  private animationHandle: number | null = null;
  private currentLesson: Lesson = createFizLesson();
  private isAdvancing: boolean = false;
  private tutorialActive: boolean = false;
  private disableAnimations: boolean = false;

  public setCallbacks(
    setEditorText: (text: string) => void,
    setTutorialHeaderText: (text: string) => void,
    setExamplesText: (text: string) => void,
    onTutorialComplete: (() => void) | null = null,
  ): void {
    this.callbacks = {
      setEditorText,
      setTutorialHeaderText,
      setExamplesText,
      onTutorialComplete,
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

  public startTutorial(): void {
    if (
      !this.callbacks.setEditorText ||
      !this.callbacks.setTutorialHeaderText ||
      !this.callbacks.setExamplesText
    ) {
      console.warn("Text editor callbacks not set. Cannot start tutorial.");
      return;
    }
    this.currentLesson.reset();
    this.tutorialActive = true;
    this.setEditorText("");
    const firstPuzzlet = this.currentLesson.getCurrentPuzzlet();
    this.animatePuzzlet(firstPuzzlet);
  }

  public stopTutorial(): void {
    this.tutorialActive = false;
    this.cancelAnimation();
  }

  public async onCompilation(compilation: Compilation): Promise<void> {
    if (!this.tutorialActive || this.isAdvancing) return;
    if (!this.currentLesson.canAdvance(compilation)) return;
    this.isAdvancing = true;
    try {
      await this.delay(500); // Small delay before advancing to allow user to see the successful change
      if (!this.tutorialActive) return;
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

    if (puzzlet.clearEditorOnStart) {
      this.setEditorText("");
    }

    let headerText = this.getProgressString();

    // If animations are disabled, show all text immediately
    if (this.disableAnimations) {
      headerText += puzzlet.instructions.map((step) => step.text).join("");
      this.setTutorialHeaderText("/* " + headerText + " */\n");

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
}
