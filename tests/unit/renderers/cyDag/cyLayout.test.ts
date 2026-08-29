import { describe, test, expect } from "vitest";
import { NodeSingular } from "cytoscape";
import { Dag } from "src/compiler/dag";
import {
  getLayoutName,
  getLayoutSignature,
  isManualLayout,
  makeLayoutOptions,
} from "src/renderers/cyDag/cyLayout";

function makeDagWithDirective(
  rendererName: string,
  properties: [string, string][],
): Dag {
  const dag = new Dag("DagId");
  dag.addRendererDirective(rendererName, {
    styleTags: [],
    styleProperties: new Map(properties),
  });
  return dag;
}

// The layout options are a discriminated union; tests read them as a plain bag.
type OptionBag = Record<string, unknown>;

function optionsFor(properties: [string, string][]): OptionBag {
  const dag = makeDagWithDirective("cytoscape", properties);
  return makeLayoutOptions(dag) as unknown as OptionBag;
}

function groupFor(properties: [string, string][], group: string): OptionBag {
  return optionsFor(properties)[group] as OptionBag;
}

// Minimal stand-in for a cytoscape node exposing only data("order"),
// which is all the sort hint reads.
function makeOrderedNode(order: number[]): NodeSingular {
  return { data: () => order } as unknown as NodeSingular;
}

type SortHint = (a: NodeSingular, b: NodeSingular) => number;

describe("layout selection", () => {
  test("no directive uses the default layout", () => {
    const dag = new Dag("DagId");
    expect(getLayoutName(dag)).toBe("dagre");
    expect(makeLayoutOptions(dag).name).toBe("dagre");
  });
  test.each(["dagre", "breadthfirst", "elk"])(
    "%s is selectable",
    (layoutName) => {
      const dag = makeDagWithDirective("cytoscape", [["layout", layoutName]]);
      expect(getLayoutName(dag)).toBe(layoutName);
      expect(makeLayoutOptions(dag).name).toBe(layoutName);
    },
  );
  test("manual is selectable and runs cytoscape's preset layout", () => {
    const dag = makeDagWithDirective("cytoscape", [["layout", "manual"]]);
    expect(getLayoutName(dag)).toBe("manual");
    expect(makeLayoutOptions(dag).name).toBe("preset");
  });
  test("case and surrounding whitespace are tolerated", () => {
    const dag = makeDagWithDirective("cytoscape", [["layout", " ELK "]]);
    expect(getLayoutName(dag)).toBe("elk");
  });
  test("unrecognized layout falls back to the default", () => {
    // Directives are not validated, so a typo silently renders as usual.
    const dag = makeDagWithDirective("cytoscape", [["layout", "elkk"]]);
    expect(getLayoutName(dag)).toBe("dagre");
  });
  test("directive for another renderer is ignored", () => {
    const dag = makeDagWithDirective("minimal", [["layout", "elk"]]);
    expect(getLayoutName(dag)).toBe("dagre");
  });
  test("layout resolves through a style tag", () => {
    const dag = new Dag("DagId");
    dag.setStyle("hierarchical", new Map([["layout", "elk"]]));
    dag.addRendererDirective("cytoscape", {
      styleTags: [["hierarchical"]],
      styleProperties: new Map(),
    });
    expect(getLayoutName(dag)).toBe("elk");
  });
});

// rankDir is dagre's own option, resolved by its entry in the dagre provider's
// option table like any other; these cover the directive reaching the emitted
// options bag rather than a rankDir-specific code path.
describe("rank direction resolution", () => {
  test("no directive leaves rankDir unset", () => {
    expect(makeLayoutOptions(new Dag("DagId"))).not.toHaveProperty("rankDir");
  });
  test("recognized direction is applied", () => {
    expect(optionsFor([["rankDir", "LR"]]).rankDir).toBe("LR");
  });
  test("lowercase direction is normalized", () => {
    expect(optionsFor([["rankDir", "lr"]]).rankDir).toBe("LR");
  });
  test("surrounding whitespace is tolerated", () => {
    expect(optionsFor([["rankDir", " BT "]]).rankDir).toBe("BT");
  });
  test("unrecognized direction is omitted entirely", () => {
    // Directives are not validated, so a typo silently falls back to the
    // dagre default rather than emitting an invalid option.
    expect(optionsFor([["rankDir", "sideways"]])).not.toHaveProperty("rankDir");
  });
  test("directive for another renderer is ignored", () => {
    const dag = makeDagWithDirective("minimal", [["rankDir", "LR"]]);
    expect(makeLayoutOptions(dag)).not.toHaveProperty("rankDir");
  });
  test("rankDir resolves through a style tag", () => {
    const dag = new Dag("DagId");
    dag.setStyle("compact", new Map([["rankDir", "RL"]]));
    dag.addRendererDirective("cytoscape", {
      styleTags: [["compact"]],
      styleProperties: new Map(),
    });
    const options = makeLayoutOptions(dag) as unknown as OptionBag;
    expect(options.rankDir).toBe("RL");
  });
});

describe("dagre layout options", () => {
  test("layout name is dagre by default", () => {
    expect(makeLayoutOptions(new Dag("DagId")).name).toBe("dagre");
  });
  test("insertion order sort hint is preserved", () => {
    const sort = optionsFor([]).sort as SortHint;
    expect(sort(makeOrderedNode([0]), makeOrderedNode([1]))).toBeLessThan(0);
    expect(sort(makeOrderedNode([2]), makeOrderedNode([1]))).toBeGreaterThan(0);
    expect(sort(makeOrderedNode([1]), makeOrderedNode([1]))).toBe(0);
  });
  test("sort hint compares nested lineage order", () => {
    const sort = optionsFor([]).sort as SortHint;
    expect(sort(makeOrderedNode([1, 0]), makeOrderedNode([1, 1]))).toBeLessThan(
      0,
    );
    expect(sort(makeOrderedNode([1]), makeOrderedNode([1, 0]))).toBeLessThan(0);
  });
  test("sort hint is present alongside a rankDir", () => {
    const options = optionsFor([["rankDir", "LR"]]);
    expect(options.rankDir).toBe("LR");
    expect(typeof options.sort).toBe("function");
  });
  test("spacing options are parsed as numbers", () => {
    const options = optionsFor([
      ["nodeSep", "40"],
      ["rankSep", "80"],
      ["edgeSep", "10"],
    ]);
    expect(options.nodeSep).toBe(40);
    expect(options.rankSep).toBe(80);
    expect(options.edgeSep).toBe(10);
  });
  test("non-numeric spacing is dropped", () => {
    expect(optionsFor([["nodeSep", "wide"]])).not.toHaveProperty("nodeSep");
  });
  test("negative spacing is dropped", () => {
    expect(optionsFor([["nodeSep", "-5"]])).not.toHaveProperty("nodeSep");
  });
  test("spacingFactor must be strictly positive", () => {
    expect(optionsFor([["spacingFactor", "1.5"]]).spacingFactor).toBe(1.5);
    expect(optionsFor([["spacingFactor", "0"]])).not.toHaveProperty(
      "spacingFactor",
    );
  });
  test("enum options are normalized", () => {
    expect(optionsFor([["ranker", "TIGHT-TREE"]]).ranker).toBe("tight-tree");
    expect(optionsFor([["align", "ul"]]).align).toBe("UL");
  });
  test("options belonging to another layout are ignored", () => {
    expect(optionsFor([["thoroughness", "9"]])).not.toHaveProperty(
      "thoroughness",
    );
  });
});

describe("breadthfirst layout options", () => {
  const asBreadthfirst = (
    properties: [string, string][] = [],
  ): [string, string][] => [["layout", "breadthfirst"], ...properties];

  test("defaults carry a depth sort hint and directed edges", () => {
    const options = optionsFor(asBreadthfirst());
    expect(options.name).toBe("breadthfirst");
    expect(typeof options.depthSort).toBe("function");
    expect(options.directed).toBe(true);
  });
  test("defaults are overridable", () => {
    expect(optionsFor(asBreadthfirst([["directed", "false"]])).directed).toBe(
      false,
    );
  });
  test("direction is normalized to lower case", () => {
    expect(
      optionsFor(asBreadthfirst([["direction", "RIGHTWARD"]])).direction,
    ).toBe("rightward");
  });
  test("booleans accept numeric literals", () => {
    const options = optionsFor(
      asBreadthfirst([
        ["circle", "1"],
        ["grid", "0"],
      ]),
    );
    expect(options.circle).toBe(true);
    expect(options.grid).toBe(false);
  });
  test("unparseable booleans are dropped", () => {
    expect(optionsFor(asBreadthfirst([["maximal", "yes"]]))).not.toHaveProperty(
      "maximal",
    );
  });
  test("dagre options are ignored", () => {
    expect(optionsFor(asBreadthfirst([["rankDir", "LR"]]))).not.toHaveProperty(
      "rankDir",
    );
  });
});

describe("elk layout options", () => {
  const asElk = (properties: [string, string][] = []): [string, string][] => [
    ["layout", "elk"],
    ...properties,
  ];

  test("defaults handle compound nodes and model order", () => {
    const elk = groupFor(asElk(), "elk");
    expect(elk.algorithm).toBe("layered");
    expect(elk["elk.hierarchyHandling"]).toBe("INCLUDE_CHILDREN");
    expect(elk["elk.layered.considerModelOrder.strategy"]).toBe(
      "NODES_AND_EDGES",
    );
  });
  test("dashed keys become dotted elk option ids", () => {
    const elk = groupFor(asElk([["elk-direction", "right"]]), "elk");
    expect(elk["elk.direction"]).toBe("RIGHT");
  });
  test("algorithm overrides the default under the bare key", () => {
    const elk = groupFor(asElk([["elk-algorithm", "MrTree"]]), "elk");
    expect(elk.algorithm).toBe("mrtree");
  });
  test("numeric options are stringified for elk", () => {
    const elk = groupFor(asElk([["elk-spacing-nodeNode", "40"]]), "elk");
    expect(elk["elk.spacing.nodeNode"]).toBe("40");
  });
  test("unlisted elk keys pass through unvalidated", () => {
    const elk = groupFor(asElk([["elk-spacing-edgeNode", "12"]]), "elk");
    expect(elk["elk.spacing.edgeNode"]).toBe("12");
  });
  test("unparseable values leave the default in place", () => {
    const elk = groupFor(asElk([["elk-algorithm", "spaghetti"]]), "elk");
    expect(elk.algorithm).toBe("layered");
  });
  test("shared options stay at the top level", () => {
    const options = optionsFor(asElk([["padding", "30"]]));
    expect(options.padding).toBe(30);
    expect(groupFor(asElk([["padding", "30"]]), "elk")).not.toHaveProperty(
      "padding",
    );
  });
  test("elk keys are ignored by other layouts", () => {
    expect(optionsFor([["elk-direction", "RIGHT"]])).not.toHaveProperty("elk");
  });
  test("schema defaults are not mutated between calls", () => {
    groupFor(asElk([["elk-algorithm", "force"]]), "elk");
    expect(groupFor(asElk(), "elk").algorithm).toBe("layered");
  });
});

describe("manual layout options", () => {
  const asManual = (
    properties: [string, string][] = [],
  ): [string, string][] => [["layout", "manual"], ...properties];

  test("is reported as manual only when selected", () => {
    expect(isManualLayout(makeDagWithDirective("cytoscape", asManual()))).toBe(
      true,
    );
    expect(isManualLayout(new Dag("DagId"))).toBe(false);
    expect(
      isManualLayout(makeDagWithDirective("cytoscape", [["layout", "elk"]])),
    ).toBe(false);
  });
  test("defaults leave the viewport where the user put it", () => {
    expect(optionsFor(asManual()).fit).toBe(false);
  });
  test("viewport options are overridable", () => {
    const options = optionsFor(
      asManual([
        ["fit", "true"],
        ["padding", "40"],
      ]),
    );
    expect(options.fit).toBe(true);
    expect(options.padding).toBe(40);
  });
  test("carries no sort hint, having nothing to order", () => {
    expect(optionsFor(asManual())).not.toHaveProperty("sort");
  });
  test("options belonging to a positioning layout are ignored", () => {
    const options = optionsFor(
      asManual([
        ["rankDir", "LR"],
        ["spacingFactor", "2"],
        ["nodeDimensionsIncludeLabels", "true"],
      ]),
    );
    expect(options).not.toHaveProperty("rankDir");
    expect(options).not.toHaveProperty("spacingFactor");
    expect(options).not.toHaveProperty("nodeDimensionsIncludeLabels");
  });
});

describe("layout signature", () => {
  test("is stable for the same directive", () => {
    const properties: [string, string][] = [
      ["layout", "elk"],
      ["elk-direction", "RIGHT"],
    ];
    const first = makeDagWithDirective("cytoscape", properties);
    const second = makeDagWithDirective("cytoscape", properties);
    expect(getLayoutSignature(first)).toBe(getLayoutSignature(second));
  });
  test("changes when an option changes", () => {
    const before = makeDagWithDirective("cytoscape", [["nodeSep", "40"]]);
    const after = makeDagWithDirective("cytoscape", [["nodeSep", "80"]]);
    expect(getLayoutSignature(before)).not.toBe(getLayoutSignature(after));
  });
  test("changes when the layout changes", () => {
    const before = makeDagWithDirective("cytoscape", [["layout", "dagre"]]);
    const after = makeDagWithDirective("cytoscape", [["layout", "elk"]]);
    expect(getLayoutSignature(before)).not.toBe(getLayoutSignature(after));
  });
  test("ignores an unrecognized value that changes nothing", () => {
    const plain = makeDagWithDirective("cytoscape", []);
    const typo = makeDagWithDirective("cytoscape", [["nodeSep", "wide"]]);
    expect(getLayoutSignature(plain)).toBe(getLayoutSignature(typo));
  });
  test("changes when a positioning layout is swapped for manual", () => {
    // Editing only the layout line leaves the element set identical, so the
    // renderer relies on this to notice it should stop repositioning nodes.
    const before = makeDagWithDirective("cytoscape", [["layout", "dagre"]]);
    const after = makeDagWithDirective("cytoscape", [["layout", "manual"]]);
    expect(getLayoutSignature(before)).not.toBe(getLayoutSignature(after));
  });
  test("omits the function-valued sort hints", () => {
    expect(getLayoutSignature(new Dag("DagId"))).not.toContain("sort");
  });
});
