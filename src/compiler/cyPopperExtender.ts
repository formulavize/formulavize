import cytoscape, { Selector } from "cytoscape";
import { DESCRIPTION_PROPERTY, DESCRIPTION_PREFIX } from "./constants";
import { Dag, DagElement, ElementId, StyleTag, StyleProperties } from "./dag";

const POPPER_OUTER_DIV_CLASS: string = "popper-outer-div";
const POPPER_INNER_DIV_CLASS: string = "popper-inner-div";

export interface DescriptionData {
  description: string;
  descriptionStyleProperties: StyleProperties;
}
export type SelectorDescriptionPair = [Selector, DescriptionData];

export function makeDagLineageSelector(dag: Dag): string {
  return !dag.Parent ? "" : `[lineagePath*='/${dag.Id}']`;
}

export function getDescriptionProperties(
  styleProperties: StyleProperties,
): StyleProperties {
  // get only properties that starts with DESCRIPTION_PREFIX
  // from styleProperties and remove the prefix
  // e.g. Map(["description-color", "black"]) -> Map(["color", "black"])
  return new Map(
    Array.from(styleProperties.entries())
      .filter(([key, _]) => key.startsWith(DESCRIPTION_PREFIX))
      .map(([key, value]) => [key.slice(DESCRIPTION_PREFIX.length), value]),
  );
}

export function getDescriptionData(
  styleProperties: StyleProperties,
): DescriptionData | null {
  const description = styleProperties.get(DESCRIPTION_PROPERTY);
  // return early if there is no description to apply styles to
  if (!description) return null;
  const descriptionStyleMap = getDescriptionProperties(styleProperties);
  return { description, descriptionStyleProperties: descriptionStyleMap };
}

export function getStyleDescriptions(dag: Dag): SelectorDescriptionPair[] {
  const lineageSelector = makeDagLineageSelector(dag);
  // no need to getStyles because styles are already flattened
  const styleEntries = Array.from(dag.getFlattenedStyles().entries());
  return Array.from(
    styleEntries
      .map(([styleTag, styleProperties]) => [
        `.${styleTag}${lineageSelector}`,
        getDescriptionData(styleProperties),
      ])
      .filter(([_, descriptionData]) => !!descriptionData),
  ) as SelectorDescriptionPair[];
}

export function styleTagsToDescriptionsList(
  dag: Dag,
  styleTags: StyleTag[],
): DescriptionData[] {
  return styleTags
    .map((styleTag) => dag.getStyle(styleTag))
    .filter((styleProperties) => styleProperties?.get(DESCRIPTION_PROPERTY))
    .map((styleProperties) => getDescriptionData(styleProperties!))
    .filter(Boolean) as DescriptionData[];
}

export function getNamesWithStyleDescriptions(
  dag: Dag,
): SelectorDescriptionPair[] {
  const lineageSelector = makeDagLineageSelector(dag);
  const bindingEntries = Array.from(dag.getStyleBindings().entries());
  return Array.from(
    bindingEntries.flatMap(([keyword, styleTags]) => {
      const keywordSelector = `[name='${keyword}']${lineageSelector}`;
      return styleTagsToDescriptionsList(dag, styleTags).map(
        (descriptionData) => [keywordSelector, descriptionData],
      );
    }),
  ) as SelectorDescriptionPair[];
}

function getElementDescriptions(
  dag: Dag,
  dagElements: DagElement[],
): [ElementId, DescriptionData][] {
  return dagElements.flatMap((dagElement) => {
    const descriptionData = getDescriptionData(dagElement.styleProperties);
    const result: [ElementId, DescriptionData][] = descriptionData
      ? [[dagElement.id, descriptionData]]
      : [];
    // scoped style tags on elements are not handled by class selectors
    // from getStyleDescriptions so we need to add them here
    // this may switch to styleProperties then last styleTag precedence later
    const scopedStyleTags = dagElement.styleTags.filter(
      (styleTag) => styleTag.length > 1,
    );
    return result.concat(
      styleTagsToDescriptionsList(dag, scopedStyleTags).map(
        (descriptionData) =>
          [dagElement.id, descriptionData] as [ElementId, DescriptionData],
      ),
    );
  });
}
export function getNodeDescriptions(dag: Dag): SelectorDescriptionPair[] {
  const nodeDescs = getElementDescriptions(dag, dag.getNodeList());
  return Array.from(nodeDescs, ([id, descData]) => [`node#${id}`, descData]);
}

export function getEdgeDescriptions(dag: Dag): SelectorDescriptionPair[] {
  const edgeDescs = getElementDescriptions(dag, dag.getEdgeList());
  return Array.from(edgeDescs, ([id, descData]) => [`edge#${id}`, descData]);
}

export function getCompoundNodeDescriptions(
  dag: Dag,
): SelectorDescriptionPair[] {
  const compNodeDesc = getElementDescriptions(dag, [dag.getDagAsDagNode()]);
  return Array.from(compNodeDesc, ([id, descData]) => [`node#${id}`, descData]);
}

function clearAllPopperDivs() {
  const popperOuterDivArray = Array.from(
    document.getElementsByClassName(POPPER_OUTER_DIV_CLASS),
  );
  popperOuterDivArray.forEach((popperOuterDiv) => {
    popperOuterDiv.remove();
  });
}

function makePopperDiv(descriptionData: DescriptionData): HTMLDivElement {
  // create an inner div to separate our styles from popper css properties
  const innerDiv = document.createElement("div");
  // inner div styles required for correct zoom sizing
  innerDiv.style.position = "relative";
  innerDiv.style.transformOrigin = "top";
  innerDiv.style.display = "inline-block";

  // add popper class to inner div to allow for manipulation later
  innerDiv.classList.add(POPPER_INNER_DIV_CLASS);
  // add custom description styles to inner div
  descriptionData.descriptionStyleProperties.forEach((value, property) => {
    innerDiv.style.setProperty(property, value);
  });

  const text = document.createElement("p");
  // render newlines as line breaks
  text.innerHTML = descriptionData.description.replace(
    /(?:\r\n|\r|\n)/g,
    "<br />",
  );
  text.style.margin = "1em";

  innerDiv.appendChild(text);

  // outer div will receive popper css properties
  const outerDiv = document.createElement("div");
  outerDiv.classList.add(POPPER_OUTER_DIV_CLASS);
  outerDiv.appendChild(innerDiv);

  return outerDiv;
}

function addDescriptionPopper(
  cy: cytoscape.Core,
  canvasElement: HTMLElement,
  cySelection: Selector,
  descriptionData: DescriptionData,
) {
  cy.elements(cySelection).forEach((cyElement) => {
    const popperElement = cyElement.popper({
      content: () => {
        const popperDiv = makePopperDiv(descriptionData);
        canvasElement.appendChild(popperDiv);
        return popperDiv;
      },
    });
    cy.on("pan zoom resize", () => {
      popperElement.update();
    });
  });
}

export function addCyPopperElementsFromDag(
  cy: cytoscape.Core,
  canvasElement: HTMLElement,
  dag: Dag,
) {
  const selectorDescriptionPairs: SelectorDescriptionPair[][] = [
    getNodeDescriptions(dag),
    getEdgeDescriptions(dag),
    getStyleDescriptions(dag),
    getNamesWithStyleDescriptions(dag),
    getCompoundNodeDescriptions(dag),
  ];
  selectorDescriptionPairs.flat().forEach(([selector, descriptionData]) => {
    addDescriptionPopper(cy, canvasElement, selector, descriptionData);
  });

  dag.getChildDags().forEach((childDag) => {
    addCyPopperElementsFromDag(cy, canvasElement, childDag);
  });
}

export function extendCyPopperElements(cy: cytoscape.Core, dag: Dag) {
  clearAllPopperDivs();

  const canvasElement = document.getElementById("canvas") ?? document.body;

  addCyPopperElementsFromDag(cy, canvasElement, dag);

  // scale popper divs with zoom level
  cy.on("zoom", () => {
    const zoomLevel = cy.zoom();
    const popperInnerDivArray = Array.from(
      document.getElementsByClassName(POPPER_INNER_DIV_CLASS),
    );
    popperInnerDivArray.forEach((popperInnerDiv) => {
      const popperDivElement = popperInnerDiv as HTMLElement;
      popperDivElement.style.transform = `scale(${zoomLevel})`;
    });
  });
}
