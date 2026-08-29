import { CyLayoutProvider, LayoutOptionSpec } from "./types";
import {
  parseBoolean,
  parseEnum,
  parsePositive,
  sortByInsertionOrder,
  lowerCase,
  SHARED_OPTIONS,
} from "./optionParsers";

// https://js.cytoscape.org/#layouts/breadthfirst
// Built into cytoscape core, so it needs no extension registration. Note that
// breadthfirst ignores compound parents: a recipe using namespaces will draw
// its children on top of the namespace box. 'roots' is deliberately not exposed
// because it takes element ids, which are generated uuids a recipe cannot name.
const BREADTHFIRST_OPTIONS: LayoutOptionSpec[] = [
  {
    directiveKey: "direction",
    parse: parseEnum(
      ["downward", "upward", "rightward", "leftward"],
      lowerCase,
    ),
  },
  {
    directiveKey: "directed",
    parse: parseBoolean,
  },
  { directiveKey: "circle", parse: parseBoolean },
  { directiveKey: "grid", parse: parseBoolean },
  { directiveKey: "maximal", parse: parseBoolean },
  {
    directiveKey: "avoidOverlap",
    parse: parseBoolean,
  },
  {
    directiveKey: "spacingFactor",
    parse: parsePositive,
  },
  ...SHARED_OPTIONS,
];

export const breadthfirstLayout: CyLayoutProvider = {
  layoutName: "breadthfirst",
  // depthSort is breadthfirst's analogue of dagre's sort hint.
  defaultOptions: { depthSort: sortByInsertionOrder, directed: true },
  options: BREADTHFIRST_OPTIONS,
};
