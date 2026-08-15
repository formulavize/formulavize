import { LayoutOptions, NodeSingular } from "cytoscape";
import { Dag } from "../../compiler/dag";
import { RANK_DIR_PROPERTY } from "../../compiler/constants";
import { getCytoscapeDirectiveProperties } from "./cyRendererDirectives";

export const RANK_DIRECTIONS = ["TB", "BT", "LR", "RL"] as const;
export type RankDirection = (typeof RANK_DIRECTIONS)[number];

// Dagre layout options type - refer to dagre documentation and cytoscape-dagre typings
// https://github.com/cytoscape/cytoscape.js-dagre?tab=readme-ov-file#api
// cytoscape's LayoutOptions has no rankDir and cytoscape-dagre ships no
// typings, so the dagre-specific members are declared here.
export type DagreLayoutOptions = LayoutOptions & {
  name: "dagre";
  sort: (a: NodeSingular, b: NodeSingular) => number;
  rankDir?: RankDirection;
};

// We define a custom sort function to encourage the layout manager
// to follow the insertion order of nodes in the DAG.
// However, Dagre's crossing minimization may still rearrange nodes in a way
// that doesn't preserve the insertion order.
const sortByInsertionOrder = (A: NodeSingular, B: NodeSingular): number => {
  const orderA: number[] = A.data("order") ?? [];
  const orderB: number[] = B.data("order") ?? [];
  for (let i = 0; i < Math.min(orderA.length, orderB.length); i++) {
    if (orderA[i] !== orderB[i]) return orderA[i] - orderB[i];
  }
  return orderA.length - orderB.length;
};

/**
 * Rank direction from a '^cytoscape{ rankDir: "LR" }' directive.
 *
 * Unrecognized values resolve to undefined so the key is omitted entirely and
 * dagre applies its own default ('TB'). Renderer directives are never
 * validated at compile time, so a typo silently changes nothing.
 */
export function getRankDirection(dag: Dag): RankDirection | undefined {
  const value = getCytoscapeDirectiveProperties(dag).get(RANK_DIR_PROPERTY);
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  return (RANK_DIRECTIONS as readonly string[]).includes(normalized)
    ? (normalized as RankDirection)
    : undefined;
}

export function makeDagreLayoutOptions(dag: Dag): DagreLayoutOptions {
  const rankDir = getRankDirection(dag);
  return {
    name: "dagre",
    sort: sortByInsertionOrder,
    ...(rankDir ? { rankDir } : {}),
  } satisfies DagreLayoutOptions;
}
