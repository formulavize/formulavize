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

function makeBindingStyleSheets(
  dag: Dag,
  bindings: Map<
    string,
    { styleTags: StyleTag[]; styleProperties: StyleProperties }
  >,
  makeSelector: (keyword: string, lineageSelector: string) => string,
): StylesheetCSS[] {
  const lineageSelector = makeDagLineageSelector(dag);
  return Array.from(bindings).flatMap(([keyword, dagStyle]) => {
    const selector = makeSelector(keyword, lineageSelector);

    const styleSheetsList = dagStyle.styleTags
      .map((styleTag) => {
        const styleProperties = dag.getStyle(styleTag);
        if (styleProperties) {
          return {
            selector,
            css: Object.fromEntries(filterCytoscapeProperties(styleProperties)),
          };
        } else {
          console.warn(`keyword ${keyword} could not be bound to ${styleTag}`);
          return null;
        }
      })
      .filter(Boolean) as StylesheetCSS[];

    if (dagStyle.styleProperties.size > 0) {
      styleSheetsList.push({
        selector,
        css: Object.fromEntries(
          filterCytoscapeProperties(dagStyle.styleProperties),
        ),
      });
    }

    return styleSheetsList;
  });
}

export function makeNameStyleSheets(dag: Dag): StylesheetCSS[] {
  return makeBindingStyleSheets(
    dag,
    dag.getStyleBindings(),
    (keyword, lineageSelector) => `[name='${keyword}']${lineageSelector}`,
  );
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

const GLOBAL_STYLE_SELECTOR_MAP: Record<string, string> = {
  node: "node:childless",
  edge: "edge",
  subgraph: "node:parent",
};

export function makeGlobalStyleSheets(dag: Dag): StylesheetCSS[] {
  return makeBindingStyleSheets(
    dag,
    dag.getGlobalStyleBindings(),
    (keyword, lineageSelector) => {
      const baseSelector = GLOBAL_STYLE_SELECTOR_MAP[keyword] ?? keyword;
      return `${baseSelector}${lineageSelector}`;
    },
  );
}

export function makeCyStylesheets(dag: Dag): StylesheetCSS[] {
  function makeChildStyleSheets(curDag: Dag): StylesheetCSS[] {
    return curDag.getChildDags().flatMap(makeCyStylesheets);
  }

  const stylesheetsList: StylesheetCSS[][] = [
    !dag.Parent ? getBaseStylesheet() : [],
    makeGlobalStyleSheets(dag),
    makeNameStyleSheets(dag),
    makeClassStyleSheets(dag),
    makeNodeStylesheets(dag),
    makeEdgeStyleSheets(dag),
    makeCompoundNodeStylesheet(dag),
    makeChildStyleSheets(dag),
  ];

  return stylesheetsList.flat();
}
