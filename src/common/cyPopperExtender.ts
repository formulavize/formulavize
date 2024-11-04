import cytoscape from "cytoscape";
import { DESCRIPTION_PROPERTY, DESCRIPTION_PREFIX } from "./constants";
import {
  Dag,
  DagElement,
  NodeId,
  EdgeId,
  ElementId,
  Keyword,
  StyleTag,
  StyleProperties,
} from "./dag";

const POPPER_OUTER_DIV_CLASS: string = "popper-outer-div";
const POPPER_INNER_DIV_CLASS: string = "popper-inner-div";

export interface DescriptionData {
  description: string;
  descriptionStyleProperties: StyleProperties;
}

export function getDescriptionProperties(
  styleProperties: StyleProperties,
): StyleProperties {
  // get only properties that starts with DESCRIPTION_PREFIX from styleProperties and remove the prefix
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

export function getStyleDescriptionData(
  dag: Dag,
): Map<string, DescriptionData> {
  return new Map<string, DescriptionData>(
    Array.from(dag.getFlattenedStyles().entries())
      .map(([styleTag, styleProperties]) => [
        styleTag,
        getDescriptionData(styleProperties),
      ])
      .filter(([_, descriptionData]) => !!descriptionData) as Iterable<
      [string, DescriptionData]
    >,
  );
}

export function styleTagHasDescriptionDefined(
  dag: Dag,
  styleTag: StyleTag,
): boolean {
  return !!dag.getStyle(styleTag)?.get(DESCRIPTION_PROPERTY);
}

export function getDescriptionDataForStyleTag(
  dag: Dag,
  styleTag: StyleTag,
): DescriptionData | null {
  const styleProperties = dag.getStyle(styleTag);
  if (!styleProperties) return null;
  return getDescriptionData(styleProperties);
}

export function getNamesWithStyleDescriptionData(
  dag: Dag,
): Map<Keyword, DescriptionData> {
  return new Map<Keyword, DescriptionData>(
    Array.from(dag.getStyleBindings().entries())
      .map(([keyword, styleTags]) => {
        // find the last style tag that has a description
        // (usage recency takes precedence)
        const usedTag = styleTags.findLast((tag) =>
          styleTagHasDescriptionDefined(dag, tag),
        );
        if (!usedTag) return null;
        const descriptionData = getDescriptionDataForStyleTag(dag, usedTag);
        if (!descriptionData) return null;
        return [keyword, descriptionData];
      })
      .filter(Boolean) as Iterable<[Keyword, DescriptionData]>,
  );
}

function getElementDescriptionData(
  dagElements: DagElement[],
): Map<ElementId, DescriptionData> {
  return new Map<ElementId, DescriptionData>(
    dagElements
      .map((dagElement) => {
        const descriptionData = getDescriptionData(dagElement.styleProperties);
        if (!descriptionData) return null;
        return [dagElement.id, descriptionData];
      })
      .filter(Boolean) as Iterable<[ElementId, DescriptionData]>,
  );
}

export function getNodeDescriptionData(dag: Dag): Map<NodeId, DescriptionData> {
  return getElementDescriptionData(dag.getNodeList());
}

export function getEdgeDescriptionData(dag: Dag): Map<EdgeId, DescriptionData> {
  return getElementDescriptionData(dag.getEdgeList());
}

export function getCompoundNodeDescriptionData(
  dag: Dag,
): Map<NodeId, DescriptionData> {
  return getElementDescriptionData([dag.getDagAsDagNode()]);
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
  cySelection: string,
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
  function mapMapKeys<K, V, R>(
    map: Map<K, V>,
    mapFn: (key: K) => R,
  ): Map<R, V> {
    return new Map<R, V>(
      Array.from(map.entries()).map(([key, value]) => [mapFn(key), value]),
    );
  }
  function addSelectorDesc(descriptionDataMap: Map<string, DescriptionData>) {
    descriptionDataMap.forEach((descriptionData, selector) => {
      addDescriptionPopper(cy, canvasElement, selector, descriptionData);
    });
  }

  const descriptionDataWithSelectorKeyFunc: [
    Map<string, DescriptionData>, // description data map
    (key: string) => string, // makes a selector from a key
  ][] = [
    [getNodeDescriptionData(dag), (id: string) => `node#${id}`],
    [getEdgeDescriptionData(dag), (id: string) => `edge#${id}`],
    [getStyleDescriptionData(dag), (tag: string) => `.${tag}`],
    [
      getNamesWithStyleDescriptionData(dag),
      (keyword: string) => `[name='${keyword}']`,
    ],
    [getCompoundNodeDescriptionData(dag), (id: string) => `node#${id}`],
  ];
  descriptionDataWithSelectorKeyFunc.forEach(([dataMap, selectorFunc]) => {
    addSelectorDesc(mapMapKeys(dataMap, selectorFunc));
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
