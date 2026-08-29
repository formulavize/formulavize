import { NodeSingular } from "cytoscape";
import { z } from "zod";
import { LayoutOptionSpec, OptionParser } from "./types";

const toOptionParser = <T>(schema: z.ZodType<T>): OptionParser => {
  return (raw: string) => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  };
};

export function parseEnum(
  allowed: readonly string[],
  normalize: (value: string) => string,
): OptionParser {
  const allowedSet = new Set(allowed);
  const schema = z
    .string()
    .transform((value) => normalize(value.trim()))
    .refine((value) => allowedSet.has(value));
  return toOptionParser(schema);
}

export const upperCase = (value: string): string => value.toUpperCase();
export const lowerCase = (value: string): string => value.toLowerCase();

interface NumberConstraints {
  min?: number;
  max?: number;
  isInteger?: boolean;
}

export function parseNumber(constraints: NumberConstraints = {}): OptionParser {
  const { min, max, isInteger } = constraints;

  let schema: z.ZodType<number> = z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value !== "")
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value));

  if (isInteger) schema = schema.refine((value) => Number.isInteger(value));
  if (min !== undefined) schema = schema.refine((value) => value >= min);
  if (max !== undefined) schema = schema.refine((value) => value <= max);

  return toOptionParser(schema);
}

export const parseBoolean: OptionParser = toOptionParser(
  z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine(
      (value) =>
        value === "true" || value === "false" || value === "1" || value === "0",
    )
    .transform((value) => value === "true" || value === "1"),
);

export const parseNonNegative = parseNumber({ min: 0 });
export const parsePositive = parseNumber({ min: Number.MIN_VALUE });

/**
 * Sort hint encouraging a layout to follow the DAG's insertion order.
 *
 * 'order' is a list of insertion-order indices from root to node (see
 * makeCyElements), so a lexicographic comparison preserves hierarchical
 * ordering. Crossing minimization may still rearrange nodes despite the hint.
 */
export const sortByInsertionOrder = (
  A: NodeSingular,
  B: NodeSingular,
): number => {
  const orderA: number[] = A.data("order") ?? [];
  const orderB: number[] = B.data("order") ?? [];
  for (let i = 0; i < Math.min(orderA.length, orderB.length); i++) {
    if (orderA[i] !== orderB[i]) return orderA[i] - orderB[i];
  }
  return orderA.length - orderB.length;
};

// Options every hierarchical layout understands at the top level. These are
// read by cytoscape itself rather than by the layout engine, so they stay out
// of the engine's option bag even for layouts that have one.
export const SHARED_OPTIONS: LayoutOptionSpec[] = [
  {
    directiveKey: "fit",
    topLevel: true,
    parse: parseBoolean,
  },
  {
    directiveKey: "padding",
    topLevel: true,
    parse: parseNonNegative,
  },
  {
    directiveKey: "animate",
    topLevel: true,
    parse: parseBoolean,
  },
  {
    directiveKey: "animationDuration",
    topLevel: true,
    parse: parseNonNegative,
  },
  {
    directiveKey: "nodeDimensionsIncludeLabels",
    topLevel: true,
    parse: parseBoolean,
  },
];
