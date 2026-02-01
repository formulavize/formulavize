import { StylesheetCSS } from "cytoscape";
import { DESCRIPTION_PROPERTY } from "../../compiler/constants";
import { Dag, DagElement, StyleTag, StyleProperties } from "../../compiler/dag";

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

export function getScopedStyleTagsProperties(
  dag: Dag,
  styleTags: StyleTag[],
): StyleProperties {
  return styleTags
    .filter((styleTag) => styleTag.length > 1)
    .map((styleTag) => dag.getStyle(styleTag) ?? new Map())
    .reduce((acc, styleProperties) => {
      styleProperties.forEach((value, key) => acc.set(key, value));
      return acc;
    }, new Map());
}

export function hasStyleData(dagElement: DagElement): boolean {
  // check if there are any style properties or scoped style tags
  // unscoped style tags are handled elsewhere by the class attribute
  return (
    dagElement.styleProperties.size > 0 ||
    dagElement.styleTags.some((styleTag) => styleTag.length > 1)
  );
}

export function makeStyleObject(dag: Dag, dagElement: DagElement): object {
  // merge style properties from scoped style tags and style properties
  // style properties take precedence over scoped style tags
  const styleProperties = new Map([
    ...getScopedStyleTagsProperties(dag, dagElement.styleTags),
    ...dagElement.styleProperties,
  ]);
  return Object.fromEntries(filterCytoscapeProperties(styleProperties));
}

export function makeElementStylesheets(
  dag: Dag,
  elementList: DagElement[],
  makeSelectorFunc: (id: string) => string,
): StylesheetCSS[] {
  return elementList
    .filter((element) => hasStyleData(element))
    .map((element) => ({
      selector: makeSelectorFunc(element.id),
      css: makeStyleObject(dag, element),
    }))
    .filter((stylesheet) => Object.keys(stylesheet.css).length > 0);
  // filter out empty stylesheets from any unresolved style tags
}

export function makeNodeStylesheets(dag: Dag): StylesheetCSS[] {
  return makeElementStylesheets(dag, dag.getNodeList(), (id) => `node#${id}`);
}

export function makeEdgeStyleSheets(dag: Dag): StylesheetCSS[] {
  return makeElementStylesheets(dag, dag.getEdgeList(), (id) => `edge#${id}`);
}

export function makeCompoundNodeStylesheet(dag: Dag): StylesheetCSS[] {
  const dagNode = dag.getDagAsDagNode();
  return makeElementStylesheets(dag, [dagNode], (id) => `node#${id}`);
}

export function makeDagLineageSelector(dag: Dag): string {
  return !dag.Parent ? "" : `[lineagePath*='/${dag.Id}']`;
}

export function makeClassStyleSheets(dag: Dag): StylesheetCSS[] {
  const lineageSelector = makeDagLineageSelector(dag);
  return Array.from(dag.getFlattenedStyles()).map(
    ([styleTag, styleProperties]) => ({
      selector: `.${styleTag}${lineageSelector}`,
      css: Object.fromEntries(filterCytoscapeProperties(styleProperties)),
    }),
  );
}

export function makeNameStyleSheets(dag: Dag): StylesheetCSS[] {
  const lineageSelector = makeDagLineageSelector(dag);
  const flatStyleMap = dag.getFlattenedStyles();
  return Array.from(dag.getStyleBindings())
    .flatMap(([keyword, styleTags]) =>
      styleTags.map((styleTag) => {
        // temporarily get the last part to continue existing behavior
        const tempLastPart = styleTag.at(-1) ?? "";
        const styleProperties = flatStyleMap.get(tempLastPart);
        if (styleProperties) {
          return {
            selector: `[name='${keyword}']${lineageSelector}`,
            css: Object.fromEntries(filterCytoscapeProperties(styleProperties)),
          };
        } else {
          console.warn(`keyword ${keyword} could not be bound to ${styleTag}`);
          return null;
        }
      }),
    )
    .filter(Boolean) as StylesheetCSS[];
}

export function getBaseStylesheet(): StylesheetCSS[] {
  return [
    {
      selector: "node",
      css: {
        label: "data(name)",
        "text-valign": "bottom",
        "text-wrap": "wrap",
      },
    },
    {
      selector: "edge",
      css: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
      },
    },
  ];
}

export function makeCyStylesheets(dag: Dag): StylesheetCSS[] {
  function makeChildStyleSheets(curDag: Dag): StylesheetCSS[] {
    return curDag.getChildDags().flatMap(makeCyStylesheets);
  }

  const stylesheetsList: StylesheetCSS[][] = [
    !dag.Parent ? getBaseStylesheet() : [],
    makeNodeStylesheets(dag),
    makeEdgeStyleSheets(dag),
    makeCompoundNodeStylesheet(dag),
    makeClassStyleSheets(dag),
    makeNameStyleSheets(dag),
    makeChildStyleSheets(dag),
  ];

  return stylesheetsList.flat();
}
