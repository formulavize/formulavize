import { LayoutOptions, NodeSingular } from "cytoscape";

// Dagre layout options type - refer to dagre documentation and cytoscape-dagre typings
// https://github.com/cytoscape/cytoscape.js-dagre?tab=readme-ov-file#api
export type DagreLayoutOptions = LayoutOptions & {
  name: "dagre";
  sort: (a: NodeSingular, b: NodeSingular) => number;
};

// We define a custom sort function to encourage the layout manager
// to follow the insertion order of nodes in the DAG.
// However, Dagre's crossing minimization may still rearrange nodes in a way
// that doesn't preserve the insertion order.
export const dagreLayoutOptions = {
  name: "dagre",
  sort: (A: NodeSingular, B: NodeSingular) => {
    const orderA: number[] = A.data("order") ?? [];
    const orderB: number[] = B.data("order") ?? [];
    for (let i = 0; i < Math.min(orderA.length, orderB.length); i++) {
      if (orderA[i] !== orderB[i]) return orderA[i] - orderB[i];
    }
    return orderA.length - orderB.length;
  },
} satisfies DagreLayoutOptions;
