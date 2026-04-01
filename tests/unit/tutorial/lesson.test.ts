import { describe, test, expect } from "vitest";
import { Lesson, LudicModule, Puzzlet } from "src/tutorial/lesson";
import { Compilation } from "src/compiler/compilation";

function makePuzzlet(name: string, isSuccessful = false): Puzzlet {
  return {
    name,
    instructions: [{ text: "do something", typingSpeedDelayMs: 0 }],
    examples: [{ text: "example", typingSpeedDelayMs: 0 }],
    successCondition: () => isSuccessful,
  };
}

function makeModule(name: string, puzzletNames: string[]): LudicModule {
  return { name, puzzlets: puzzletNames.map((n) => makePuzzlet(n)) };
}

function makeLesson(modules: LudicModule[]): Lesson {
  return new Lesson("Test Lesson", modules);
}

describe("Lesson", () => {
  const moduleA = makeModule("ModA", ["p1", "p2", "p3"]);
  const moduleB = makeModule("ModB", ["p4", "p5"]);
  const moduleC = makeModule("ModC", ["p6"]);

  describe("basic properties", () => {
    test("name is set", () => {
      const lesson = makeLesson([moduleA]);
      expect(lesson.Name).toBe("Test Lesson");
    });

    test("getNumPuzzlets returns total across all modules", () => {
      const lesson = makeLesson([moduleA, moduleB, moduleC]);
      expect(lesson.getNumPuzzlets()).toBe(6);
    });

    test("getModules returns all modules", () => {
      const lesson = makeLesson([moduleA, moduleB]);
      expect(lesson.getModules()).toEqual([moduleA, moduleB]);
    });

    test("starts at index 0", () => {
      const lesson = makeLesson([moduleA]);
      expect(lesson.getCurrentPuzzletIndex()).toBe(0);
    });
  });

  describe("advance", () => {
    test("increments puzzlet index", () => {
      const lesson = makeLesson([moduleA, moduleB]);
      expect(lesson.getCurrentPuzzletIndex()).toBe(0);
      lesson.advance();
      expect(lesson.getCurrentPuzzletIndex()).toBe(1);
    });

    test("advances across module boundaries", () => {
      const lesson = makeLesson([moduleA, moduleB]);
      // Advance through all of moduleA (3 puzzlets)
      lesson.advance();
      lesson.advance();
      lesson.advance();
      expect(lesson.getCurrentPuzzletIndex()).toBe(3);
      expect(lesson.getCurrentModule().name).toBe("ModB");
      expect(lesson.getCurrentPuzzlet().name).toBe("p4");
    });

    test("returns false when already complete", () => {
      const lesson = makeLesson([makeModule("M", ["only"])]);
      lesson.advance();
      expect(lesson.isComplete()).toBe(true);
      expect(lesson.advance()).toBe(false);
    });
  });

  describe("isComplete", () => {
    test("not complete at start", () => {
      const lesson = makeLesson([moduleA]);
      expect(lesson.isComplete()).toBe(false);
    });

    test("complete after all puzzlets advanced", () => {
      const lesson = makeLesson([makeModule("M", ["a", "b"])]);
      lesson.advance();
      lesson.advance();
      expect(lesson.isComplete()).toBe(true);
    });
  });

  describe("reset", () => {
    test("resets to index 0", () => {
      const lesson = makeLesson([moduleA]);
      lesson.advance();
      lesson.advance();
      lesson.reset();
      expect(lesson.getCurrentPuzzletIndex()).toBe(0);
      expect(lesson.getCurrentPuzzlet().name).toBe("p1");
    });
  });

  describe("jumpTo", () => {
    test("jumps to a specific index", () => {
      const lesson = makeLesson([moduleA, moduleB]);
      lesson.jumpTo(3);
      expect(lesson.getCurrentPuzzletIndex()).toBe(3);
      expect(lesson.getCurrentPuzzlet().name).toBe("p4");
    });

    test("clamps to 0 for negative index", () => {
      const lesson = makeLesson([moduleA]);
      lesson.jumpTo(-5);
      expect(lesson.getCurrentPuzzletIndex()).toBe(0);
    });

    test("clamps to last index for out-of-bounds", () => {
      const lesson = makeLesson([moduleA, moduleB]);
      lesson.jumpTo(100);
      expect(lesson.getCurrentPuzzletIndex()).toBe(4);
      expect(lesson.getCurrentPuzzlet().name).toBe("p5");
    });
  });

  describe("getCurrentModule", () => {
    test("returns correct module for each puzzlet", () => {
      const lesson = makeLesson([moduleA, moduleB, moduleC]);
      expect(lesson.getCurrentModule().name).toBe("ModA");
      lesson.jumpTo(3);
      expect(lesson.getCurrentModule().name).toBe("ModB");
      lesson.jumpTo(5);
      expect(lesson.getCurrentModule().name).toBe("ModC");
    });
  });

  describe("canAdvance", () => {
    test("returns false when success condition fails", () => {
      const lesson = makeLesson([makeModule("M", ["p"])]);
      const compilation = {} as Compilation;
      expect(lesson.canAdvance(compilation)).toBe(false);
    });

    test("returns true when success condition passes", () => {
      const alwaysPass: Puzzlet = {
        name: "pass",
        instructions: [],
        examples: [],
        successCondition: () => true,
      };
      const lesson = new Lesson("L", [{ name: "M", puzzlets: [alwaysPass] }]);
      const compilation = {} as Compilation;
      expect(lesson.canAdvance(compilation)).toBe(true);
    });

    test("returns false when lesson is complete", () => {
      const alwaysPass: Puzzlet = {
        name: "pass",
        instructions: [],
        examples: [],
        successCondition: () => true,
      };
      const lesson = new Lesson("L", [{ name: "M", puzzlets: [alwaysPass] }]);
      lesson.advance();
      expect(lesson.canAdvance({} as Compilation)).toBe(false);
    });
  });

  describe("getAllModuleStartIndices", () => {
    test("returns correct start indices", () => {
      const lesson = makeLesson([moduleA, moduleB, moduleC]);
      expect(lesson.getAllModuleStartIndices()).toEqual([0, 3, 5]);
    });

    test("single module starts at 0", () => {
      const lesson = makeLesson([moduleA]);
      expect(lesson.getAllModuleStartIndices()).toEqual([0]);
    });

    test("empty modules list returns empty array", () => {
      const lesson = makeLesson([]);
      expect(lesson.getAllModuleStartIndices()).toEqual([]);
    });
  });
});
