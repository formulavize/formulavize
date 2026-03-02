import { Compilation } from "../compiler/compilation";

export interface AnimationStep {
  text: string;
  typingSpeedDelayMs: number;
}

// Teach each grammar rule as a ludeme
export interface Puzzlet {
  name: string;
  instructions: AnimationStep[];
  examples: AnimationStep[];
  clearEditorOnStart?: boolean;
  successCondition: (compilation: Compilation) => boolean;
}

export interface LudicModule {
  name: string;
  puzzlets: Puzzlet[];
}

export class Lesson {
  private readonly name: string;
  private readonly modules: LudicModule[];
  private readonly flattenedPuzzlets: Puzzlet[];
  private readonly puzzletIndexToModuleIndex: number[];
  private currentPuzzletIndex: number = 0;

  constructor(name: string, modules: LudicModule[]) {
    this.name = name;
    this.modules = modules;
    this.flattenedPuzzlets = this.modules.flatMap((module) => module.puzzlets);

    // Precompute puzzlet index to module index mapping
    this.puzzletIndexToModuleIndex = this.modules.flatMap(
      (module, moduleIndex) => Array(module.puzzlets.length).fill(moduleIndex),
    );
  }

  get Name(): string {
    return this.name;
  }

  public getCurrentPuzzletIndex(): number {
    return this.currentPuzzletIndex;
  }

  public getNumPuzzlets(): number {
    return this.flattenedPuzzlets.length;
  }

  public getCurrentPuzzlet(): Puzzlet {
    return this.flattenedPuzzlets[this.currentPuzzletIndex];
  }

  public getCurrentModule(): LudicModule {
    const moduleIdx = this.puzzletIndexToModuleIndex[this.currentPuzzletIndex];
    return this.modules[moduleIdx];
  }

  public isComplete(): boolean {
    return this.currentPuzzletIndex >= this.flattenedPuzzlets.length;
  }

  public canAdvance(compilation: Compilation): boolean {
    if (this.isComplete()) return false;
    return this.getCurrentPuzzlet().successCondition(compilation);
  }

  public advance(): boolean {
    if (this.isComplete()) return false;
    this.currentPuzzletIndex++;
    return true;
  }

  public reset(): void {
    this.currentPuzzletIndex = 0;
  }
}
