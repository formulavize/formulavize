import { describe, expect, test } from "vitest";
import { NodeSingular } from "cytoscape";
import {
  SHARED_OPTIONS,
  parseBoolean,
  parseEnum,
  parseNonNegative,
  parseNumber,
  parsePositive,
  sortByInsertionOrder,
  upperCase,
} from "src/renderers/cyDag/layouts/optionParsers";

function makeOrderedNode(order: number[]): NodeSingular {
  return { data: () => order } as unknown as NodeSingular;
}

describe("parseEnum", () => {
  test("normalizes and trims recognized values", () => {
    const parser = parseEnum(["LR", "TB"], upperCase);
    expect(parser(" lr ")).toBe("LR");
  });

  test("returns undefined for unrecognized values", () => {
    const parser = parseEnum(["LR", "TB"], upperCase);
    expect(parser("left")).toBeUndefined();
  });
});

describe("parseNumber", () => {
  test("parses finite numeric input", () => {
    const parser = parseNumber();
    expect(parser(" 12.5 ")).toBe(12.5);
  });

  test("returns undefined for empty or non-numeric input", () => {
    const parser = parseNumber();
    expect(parser("")).toBeUndefined();
    expect(parser("  ")).toBeUndefined();
    expect(parser("wide")).toBeUndefined();
  });

  test("returns undefined for non-finite values", () => {
    const parser = parseNumber();
    expect(parser("Infinity")).toBeUndefined();
    expect(parser("-Infinity")).toBeUndefined();
    expect(parser("NaN")).toBeUndefined();
  });

  test("respects integer constraint", () => {
    const parser = parseNumber({ isInteger: true });
    expect(parser("4")).toBe(4);
    expect(parser("4.2")).toBeUndefined();
  });

  test("respects min constraints", () => {
    const parser = parseNumber({ min: 0 });
    expect(parser("0")).toBe(0);
    expect(parser("0.1")).toBe(0.1);
    expect(parser("-0.1")).toBeUndefined();
  });

  test("respects max constraint", () => {
    const parser = parseNumber({ max: 10 });
    expect(parser("10")).toBe(10);
    expect(parser("10.1")).toBeUndefined();
  });
});

describe("parseBoolean", () => {
  test("accepts true and false tokens", () => {
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean(" TRUE ")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean(" 0 ")).toBe(false);
  });

  test("returns undefined for unrecognized tokens", () => {
    expect(parseBoolean("yes")).toBeUndefined();
  });
});

describe("parseNonNegative and parsePositive", () => {
  test("enforce zero boundary as expected", () => {
    expect(parseNonNegative("0")).toBe(0);
    expect(parseNonNegative("-1")).toBeUndefined();
    expect(parsePositive("0")).toBeUndefined();
    expect(parsePositive("0.01")).toBe(0.01);
  });
});

describe("sortByInsertionOrder", () => {
  test("compares the first differing lineage index", () => {
    expect(
      sortByInsertionOrder(makeOrderedNode([0]), makeOrderedNode([1])),
    ).toBe(-1);
    expect(
      sortByInsertionOrder(makeOrderedNode([2]), makeOrderedNode([1])),
    ).toBe(1);
  });

  test("uses length as tie-breaker when one order is a prefix", () => {
    expect(
      sortByInsertionOrder(makeOrderedNode([1]), makeOrderedNode([1, 0])),
    ).toBeLessThan(0);
    expect(
      sortByInsertionOrder(makeOrderedNode([1, 0]), makeOrderedNode([1])),
    ).toBeGreaterThan(0);
  });
});

describe("SHARED_OPTIONS", () => {
  test("marks each shared option as top-level", () => {
    expect(SHARED_OPTIONS.every((option) => option.topLevel === true)).toBe(
      true,
    );
  });

  test("contains the expected directive keys", () => {
    expect(SHARED_OPTIONS.map((option) => option.directiveKey)).toEqual([
      "fit",
      "padding",
      "animate",
      "animationDuration",
      "nodeDimensionsIncludeLabels",
    ]);
  });
});
