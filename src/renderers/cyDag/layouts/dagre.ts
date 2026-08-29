import { CyLayoutProvider, LayoutOptionSpec } from "./types";
import {
  parseEnum,
  parseNonNegative,
  parsePositive,
  sortByInsertionOrder,
  upperCase,
  lowerCase,
  SHARED_OPTIONS,
} from "./optionParsers";

// https://github.com/cytoscape/cytoscape.js-dagre#api
const DAGRE_OPTIONS: LayoutOptionSpec[] = [
  {
    directiveKey: "rankDir",
    parse: parseEnum(["TB", "BT", "LR", "RL"], upperCase),
  },
  {
    directiveKey: "align",
    parse: parseEnum(["UL", "UR", "DL", "DR"], upperCase),
  },
  {
    directiveKey: "ranker",
    parse: parseEnum(
      ["network-simplex", "tight-tree", "longest-path"],
      lowerCase,
    ),
  },
  {
    directiveKey: "acyclicer",
    parse: parseEnum(["greedy"], lowerCase),
  },
  {
    directiveKey: "nodeSep",
    parse: parseNonNegative,
  },
  {
    directiveKey: "edgeSep",
    parse: parseNonNegative,
  },
  {
    directiveKey: "rankSep",
    parse: parseNonNegative,
  },
  {
    directiveKey: "spacingFactor",
    parse: parsePositive,
  },
  ...SHARED_OPTIONS,
];

export const dagreLayout: CyLayoutProvider = {
  layoutName: "dagre",
  loadExtension: async () => (await import("cytoscape-dagre")).default,
  defaultOptions: { sort: sortByInsertionOrder },
  options: DAGRE_OPTIONS,
};
