import { CyLayoutProvider, LayoutOptionSpec } from "./types";
import {
  parseEnum,
  parseNonNegative,
  parseNumber,
  parsePositive,
  upperCase,
  lowerCase,
  SHARED_OPTIONS,
} from "./optionParsers";

// https://github.com/cytoscape/cytoscape.js-elk and
// https://eclipse.dev/elk/reference/options.html
// ELK option ids are dotted, but a fiz PropertyName is a cssIdentifier and
// cannot contain '.', so they are written with dashes and rewritten on the way
// out. Any 'elk-*' key not listed here is passed through with the same
// rewriting (see extraOption below), which keeps the full ELK option namespace
// reachable without curating all of it.
export const ELK_KEY_PREFIX = "elk-";

const ELK_OPTIONS: LayoutOptionSpec[] = [
  {
    directiveKey: "elk-algorithm",
    // cytoscape-elk's own defaults use the bare 'algorithm' key for this one.
    optionTargetKey: "algorithm",
    parse: parseEnum(
      [
        "layered",
        "mrtree",
        "force",
        "stress",
        "radial",
        "box",
        "disco",
        "random",
      ],
      lowerCase,
    ),
  },
  {
    directiveKey: "elk-direction",
    optionTargetKey: "elk.direction",
    parse: parseEnum(["DOWN", "UP", "RIGHT", "LEFT", "UNDEFINED"], upperCase),
  },
  {
    directiveKey: "elk-edgeRouting",
    optionTargetKey: "elk.edgeRouting",
    parse: parseEnum(
      ["ORTHOGONAL", "POLYLINE", "SPLINES", "UNDEFINED"],
      upperCase,
    ),
  },
  {
    directiveKey: "elk-hierarchyHandling",
    optionTargetKey: "elk.hierarchyHandling",
    parse: parseEnum(
      ["INCLUDE_CHILDREN", "SEPARATE_CHILDREN", "INHERIT"],
      upperCase,
    ),
  },
  {
    directiveKey: "elk-aspectRatio",
    optionTargetKey: "elk.aspectRatio",
    parse: parsePositive,
  },
  {
    directiveKey: "elk-randomSeed",
    optionTargetKey: "elk.randomSeed",
    parse: parseNumber({ isInteger: true }),
  },
  {
    directiveKey: "elk-spacing-nodeNode",
    optionTargetKey: "elk.spacing.nodeNode",
    parse: parseNonNegative,
  },
  {
    directiveKey: "elk-layered-spacing-nodeNodeBetweenLayers",
    optionTargetKey: "elk.layered.spacing.nodeNodeBetweenLayers",
    parse: parseNonNegative,
  },
  {
    directiveKey: "elk-layered-nodePlacement-strategy",
    optionTargetKey: "elk.layered.nodePlacement.strategy",
    parse: parseEnum(
      [
        "SIMPLE",
        "INTERACTIVE",
        "LINEAR_SEGMENTS",
        "BRANDES_KOEPF",
        "NETWORK_SIMPLEX",
      ],
      upperCase,
    ),
  },
  {
    directiveKey: "elk-layered-crossingMinimization-strategy",
    optionTargetKey: "elk.layered.crossingMinimization.strategy",
    parse: parseEnum(["LAYER_SWEEP", "INTERACTIVE", "NONE"], upperCase),
  },
  {
    directiveKey: "elk-layered-cycleBreaking-strategy",
    optionTargetKey: "elk.layered.cycleBreaking.strategy",
    parse: parseEnum(
      [
        "GREEDY",
        "DEPTH_FIRST",
        "INTERACTIVE",
        "MODEL_ORDER",
        "GREEDY_MODEL_ORDER",
      ],
      upperCase,
    ),
  },
  {
    directiveKey: "elk-layered-considerModelOrder-strategy",
    optionTargetKey: "elk.layered.considerModelOrder.strategy",
    parse: parseEnum(
      ["NONE", "NODES_AND_EDGES", "PREFER_EDGES", "PREFER_NODES"],
      upperCase,
    ),
  },
  ...SHARED_OPTIONS,
];

// Rewrite an 'elk-*' directive key into its dotted ELK option id.
function toElkOptionId(key: string): string {
  return key.replace(/-/g, ".");
}

export const elkLayout: CyLayoutProvider = {
  layoutName: "elk",
  loadExtension: async () => (await import("cytoscape-elk")).default,
  optionGroup: "elk",
  defaultOptions: {
    elk: {
      algorithm: "layered",
      // Namespaces become compound nodes with edges crossing their boundary,
      // which ELK only routes correctly when children are included.
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      // ELK's analogue of dagre's sort hint: cytoscape-elk builds the graph in
      // collection order, which is the DAG's insertion order.
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
  },
  options: ELK_OPTIONS,
  // Unlisted 'elk-*' keys are an escape hatch to the rest of the ELK option
  // namespace. They are unvalidated by design; ELK ignores ids it does not know.
  extraOption: (key: string): string | undefined =>
    key.startsWith(ELK_KEY_PREFIX) ? toElkOptionId(key) : undefined,
};
