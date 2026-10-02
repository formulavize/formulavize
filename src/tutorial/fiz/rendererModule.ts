import { Puzzlet, SuccessCriterion } from "../lesson";
import { normal, fast } from "../animationHelpers";
import { getRendererDirectiveProperties } from "src/rendererApi";
import { StyleProperties } from "src/compiler/dag";
import {
  CYTOSCAPE_RENDERER_NAME,
  LAYOUT_PROPERTY,
} from "src/renderers/cyDag/constants";
import { elkLayout } from "src/renderers/cyDag/layouts/elk";
import {
  DEFAULT_CYTOSCAPE_LAYOUT,
  MANUAL_CYTOSCAPE_LAYOUT,
} from "src/renderers/cyDag/layouts/types";
import { MINIMAL_RENDERER_NAME } from "src/renderers/minExample/meta";

type PuzzletCompilation = Parameters<SuccessCriterion["check"]>[0];

function cytoscapeDirectiveProperties(
  compilation: PuzzletCompilation,
): StyleProperties {
  return getRendererDirectiveProperties(
    compilation.DAG,
    CYTOSCAPE_RENDERER_NAME,
  );
}

const directiveValueIs =
  (key: string, expected: string) =>
  (compilation: PuzzletCompilation): boolean =>
    cytoscapeDirectiveProperties(compilation).get(key)?.trim().toLowerCase() ===
    expected.toLowerCase();

const hasDirectiveFor =
  (rendererName: string) =>
  (compilation: PuzzletCompilation): boolean =>
    compilation.DAG.getRendererDirectives().has(rendererName);

const hasNonNegativeDirectiveNumber =
  (key: string) =>
  (compilation: PuzzletCompilation): boolean => {
    const rawValue = cytoscapeDirectiveProperties(compilation).get(key)?.trim();
    if (!rawValue) return false;
    const value = Number(rawValue);
    return Number.isFinite(value) && value >= 0;
  };

const caretCakePuzzlet: Puzzlet = {
  name: "Caret Cake",
  instructions: [
    normal("A renderer draws graphs.\n"),
    normal("A renderer directive picks and configures a renderer.\n"),
    normal("A renderer directive consists of '^', a renderer name, and { }.\n"),
    normal("e.g. ^minimal{ }\n"),
    normal("Directives only work at the top level, not inside namespaces.\n"),
    normal("The default renderer is cytoscape.\n"),
    normal("Only the last renderer directive gets applied.\n"),
    normal("Uncomment ^minimal{ } below."),
  ],
  examples: [
    fast("//^minimal{ }\n"),
    fast("cake = bake()\n"),
    fast("serve(cake)\n"),
  ],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: "Select the minimal renderer with ^minimal{ }",
      check: hasDirectiveFor(MINIMAL_RENDERER_NAME),
    },
  ],
};

const layOfTheLandPuzzlet: Puzzlet = {
  name: "Lay of the Land",
  instructions: [
    normal("A directive { } holds 'key: value' pairs like in style blocks.\n"),
    normal("The 'layout' key's value chooses how the nodes get placed.\n"),
    normal("'dagre' is the default cytoscape layout.\n"),
    normal("dagre's 'rankDir' sets the direction: TB, BT, LR, or RL.\n"),
    normal("Uncomment both keys to lay the graph out sideways."),
  ],
  examples: [
    fast("^cytoscape{\n"),
    fast('  //layout: "dagre"\n'),
    fast('  //rankDir: "LR"\n'),
    fast("}\n"),
    fast("a = start()\n"),
    fast("b = middle(a)\n"),
    fast("end(b)\n"),
  ],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: "Name the dagre layout in the directive",
      check: directiveValueIs(LAYOUT_PROPERTY, DEFAULT_CYTOSCAPE_LAYOUT),
    },
    {
      description: 'Turn the layout sideways with rankDir: "LR"',
      check: directiveValueIs("rankDir", "LR"),
    },
  ],
};

const laymansTerms: Puzzlet = {
  name: "Layman's Terms",
  instructions: [
    normal("Each layout manager brings its own option keys.\n"),
    normal("Keys the current layout does not understand are ignored.\n"),
    normal("The elk layout takes 'elk-' prefixed keys.\n"),
    normal("elk-direction takes DOWN, UP, RIGHT, or LEFT.\n"),
    normal("Uncomment both the layout and the direction keys."),
  ],
  examples: [
    fast("^cytoscape{\n"),
    fast('  //layout: "elk"\n'),
    fast('  //elk-direction: "RIGHT"\n'),
    fast("}\n"),
    fast("brick = load()\n"),
    fast("mortar = mix()\n"),
    fast("wall = lay(mortar, brick)\n"),
    fast("build(wall)\n"),
  ],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: "Switch the layout over to elk",
      check: directiveValueIs(LAYOUT_PROPERTY, elkLayout.layoutName),
    },
    {
      description: "Point the elk layout RIGHT",
      check: directiveValueIs("elk-direction", "RIGHT"),
    },
  ],
};

const manualLaborPuzzlet: Puzzlet = {
  name: "Manual Labour",
  instructions: [
    normal('layout: "manual" turns the layout manager off.\n'),
    normal("Nodes initially stay put and dragging nodes becomes enabled.\n"),
    normal("Every layout has a few shared options.\n"),
    normal("'padding' and 'fit' frame the graph in the view.\n"),
    normal("Set the layout to manual and give it some padding."),
  ],
  examples: [
    fast("^cytoscape{\n"),
    fast('  layout: "dagre"\n'),
    fast("  //padding: 40\n"),
    fast("}\n"),
    fast("x = one()\n"),
    fast("y = two(x)\n"),
    fast("three(y)\n"),
  ],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: 'Take over placement with layout: "manual"',
      check: directiveValueIs(LAYOUT_PROPERTY, MANUAL_CYTOSCAPE_LAYOUT),
    },
    {
      description: "Give the layout a padding value",
      check: hasNonNegativeDirectiveNumber("padding"),
    },
  ],
};

export const rendererModule = {
  name: "Renderers",
  puzzlets: [
    caretCakePuzzlet,
    layOfTheLandPuzzlet,
    laymansTerms,
    manualLaborPuzzlet,
  ],
};
