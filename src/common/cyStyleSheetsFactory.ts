import { Stylesheet } from "cytoscape";
import { DESCRIPTION_PROPERTY, TOP_LEVEL_DAG_ID } from "./constants";
import { Dag, StyleProperties } from "./dag";

// a list of known property prefixes that should not be passed to cytoscape
const NON_CYTOSCAPE_PROPERTY_PREFIXES: string[] = [
  DESCRIPTION_PROPERTY, // this captures description and all description-*
];

export function keyStartsWithNonCytoscapePrefix(key: string): boolean {
  return NON_CYTOSCAPE_PROPERTY_PREFIXES.some((nonCytoscapePropertyPrefix) =>
    key.startsWith(nonCytoscapePropertyPrefix),
  );
}

export function filterCytoscapeProperties(
  styleProperties: StyleProperties,
): StyleProperties {
  return new Map(
    Array.from(styleProperties.entries()).filter(
      ([key, _]) => !keyStartsWithNonCytoscapePrefix(key),
    ),
  );
}

export function makeNodeStylesheets(dag: Dag): Stylesheet[] {
  return dag
    .getNodeList()
    .filter((node) => node.styleProperties.size > 0)
    .map((node) => ({
      selector: `node#${node.id}`,
      style: Object.fromEntries(
        filterCytoscapeProperties(node.styleProperties),
      ),
    }));
}

export function makeEdgeStyleSheets(dag: Dag): Stylesheet[] {
  return dag
    .getEdgeList()
    .filter((edge) => edge.styleProperties.size > 0)
    .map((edge) => ({
      selector: `edge#${edge.id}`,
      style: Object.fromEntries(
        filterCytoscapeProperties(edge.styleProperties),
      ),
    }));
}

export function makeCompoundNodeStylesheet(dag: Dag): Stylesheet[] {
  const compoundNodeStylesheet = {
    selector: `node#${dag.Id}`,
    style: Object.fromEntries(
      filterCytoscapeProperties(dag.DagStyleProperties),
    ),
  };
  return dag.DagStyleProperties.size === 0 ? [] : [compoundNodeStylesheet];
}

export function makeDagLineageSelector(dag: Dag): string {
  return dag.Id === TOP_LEVEL_DAG_ID ? "" : `[lineagePath*='/${dag.Id}']`;
}

export function makeClassStyleSheets(dag: Dag): Stylesheet[] {
  const lineageSelector = makeDagLineageSelector(dag);
  return Array.from(dag.getFlattenedStyles()).map(
    ([styleTag, styleProperties]) => ({
      selector: `.${styleTag}${lineageSelector}`,
      style: Object.fromEntries(filterCytoscapeProperties(styleProperties)),
    }),
  );
}

export function makeNameStyleSheets(dag: Dag): Stylesheet[] {
  const lineageSelector = makeDagLineageSelector(dag);
  const flatStyleMap = dag.getFlattenedStyles();
  return Array.from(dag.getStyleBindings())
    .flatMap(([keyword, styleTags]) =>
      styleTags.map((styleTag) => {
        const styleProperties = flatStyleMap.get(styleTag);
        if (styleProperties) {
          return {
            selector: `[name='${keyword}']${lineageSelector}`,
            style: Object.fromEntries(
              filterCytoscapeProperties(styleProperties),
            ),
          };
        } else {
          console.log(`keyword ${keyword} could not be bound to ${styleTag}`);
          return null;
        }
      }),
    )
    .filter(Boolean) as Stylesheet[];
}

export function getBaseStylesheet(): Stylesheet[] {
  return [
    {
      selector: "node",
      style: {
        label: "data(name)",
        "text-valign": "bottom",
        "text-wrap": "wrap",
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
      },
    },
  ];
}

export function makeCyStylesheets(dag: Dag): Stylesheet[] {
  function makeChildStyleSheets(curDag: Dag): Stylesheet[] {
    return curDag.getChildDags().flatMap(makeCyStylesheets);
  }

  const stylesheets: Stylesheet[] = [
    ...(dag.Id === TOP_LEVEL_DAG_ID ? getBaseStylesheet() : []),
    ...makeNodeStylesheets(dag),
    ...makeEdgeStyleSheets(dag),
    ...makeCompoundNodeStylesheet(dag),
    ...makeClassStyleSheets(dag),
    ...makeNameStyleSheets(dag),
    ...makeChildStyleSheets(dag),
  ];

  return stylesheets;
}
