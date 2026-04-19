import cytoscape, { EventHandler, Selector } from "cytoscape";
import { PopperInstance } from "cytoscape-popper";
import {
  DESCRIPTION_PROPERTY,
  DESCRIPTION_PREFIX,
} from "../../compiler/constants";
import {
  Dag,
  DagElement,
  ElementId,
  StyleTag,
  StyleProperties,
} from "../../compiler/dag";

const POPPER_OUTER_DIV_CLASS: string = "popper-outer-div";
const POPPER_INNER_DIV_CLASS: string = "popper-inner-div";

export type PopperCleanup = () => void;

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
    bindingEntries.flatMap(([keyword, dagStyle]) => {
      const selector = `[name='${keyword}']${lineageSelector}`;
      const descList = styleTagsToDescriptionsList(dag, dagStyle.styleTags);
      const inlineDesc = getDescriptionData(dagStyle.styleProperties);
      if (inlineDesc) descList.push(inlineDesc);
      return descList.map((descData) => [selector, descData]);
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
  return Array.from(nodeDescs, ([id, descData]) => [
    `node[id = '${id}']`,
    descData,
  ]);
}

export function getEdgeDescriptions(dag: Dag): SelectorDescriptionPair[] {
  const edgeDescs = getElementDescriptions(dag, dag.getEdgeList());
  return Array.from(edgeDescs, ([id, descData]) => [
    `edge[id = '${id}']`,
    descData,
  ]);
}

export function getCompoundNodeDescriptions(
  dag: Dag,
): SelectorDescriptionPair[] {
  const compNodeDesc = getElementDescriptions(dag, [dag.getDagAsDagNode()]);
  return Array.from(compNodeDesc, ([id, descData]) => [
    `node[id = '${id}']`,
    descData,
  ]);
}

function clearAllPopperDivs(canvasElement: HTMLElement) {
  const popperOuterDivArray = Array.from(
    canvasElement.getElementsByClassName(POPPER_OUTER_DIV_CLASS),
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
  // default margin on p elements adds unwanted spacing between description poppers
  text.style.margin = "0";

  innerDiv.appendChild(text);

  // outer div will receive popper css properties
  const outerDiv = document.createElement("div");
  outerDiv.style.position = "absolute";
  outerDiv.classList.add(POPPER_OUTER_DIV_CLASS);
  outerDiv.appendChild(innerDiv);

  return outerDiv;
}

function makeDescriptionPoppers(
  cy: cytoscape.Core,
  canvasElement: HTMLElement,
  cySelection: Selector,
  descriptionData: DescriptionData,
): [string, PopperInstance][] {
  return cy.elements(cySelection).map((cyElement) => {
    const popperElement = cyElement.popper({
      content: () => {
        const popperDiv = makePopperDiv(descriptionData);
        canvasElement.appendChild(popperDiv);
        return popperDiv;
      },
      // Shift the reference point down so descriptions position below the
      // label rather than overlapping it.
      renderedPosition: (el) => {
        const ele = el as unknown as cytoscape.SingularElementReturnValue;
        const withLabels = ele.renderedBoundingBox({ includeLabels: true });
        const withoutLabels = ele.renderedBoundingBox({ includeLabels: false });
        // The label extends below the node body; shift the reference
        // point down by that overhang so the popper clears the label.
        const labelOverhang = withLabels.y2 - withoutLabels.y2;
        return {
          x: withoutLabels.x1,
          y: withoutLabels.y1 + labelOverhang,
        };
      },
    });
    return [cyElement.id(), popperElement] as [string, PopperInstance];
  });
}

const DESCRIPTION_GETTERS: ((dag: Dag) => SelectorDescriptionPair[])[] = [
  getNodeDescriptions,
  getEdgeDescriptions,
  getStyleDescriptions,
  getNamesWithStyleDescriptions,
  getCompoundNodeDescriptions,
];

export function makeCyPopperMapFromDag(
  cy: cytoscape.Core,
  canvasElement: HTMLElement,
  dag: Dag,
): Map<string, PopperInstance[]> {
  const popperMap = new Map<string, PopperInstance[]>();

  const selectorDescPairs = DESCRIPTION_GETTERS.flatMap((fn) => fn(dag));
  const idElementPairs = selectorDescPairs.flatMap(([selector, descData]) =>
    makeDescriptionPoppers(cy, canvasElement, selector, descData),
  );
  for (const [elementId, popper] of idElementPairs) {
    if (!popperMap.has(elementId)) popperMap.set(elementId, []);
    popperMap.get(elementId)!.push(popper);
  }

  for (const childDag of dag.getChildDags()) {
    const childMap = makeCyPopperMapFromDag(cy, canvasElement, childDag);
    for (const [id, poppers] of childMap.entries()) {
      const existing = popperMap.get(id);
      if (existing) {
        existing.push(...poppers);
      } else {
        popperMap.set(id, poppers);
      }
    }
  }

  return popperMap;
}

export function collectDescriptions(
  cy: cytoscape.Core,
  dag: Dag,
): Map<string, DescriptionData[]> {
  const result = new Map<string, DescriptionData[]>();
  const selectorDescPairs = DESCRIPTION_GETTERS.flatMap((fn) => fn(dag));
  for (const [selector, descData] of selectorDescPairs) {
    cy.elements(selector).forEach((ele) => {
      const id = ele.id();
      if (!result.has(id)) result.set(id, []);
      result.get(id)!.push(descData);
    });
  }

  for (const childDag of dag.getChildDags()) {
    const childMap = collectDescriptions(cy, childDag);
    for (const [id, descriptions] of childMap) {
      if (!result.has(id)) result.set(id, []);
      result.get(id)!.push(...descriptions);
    }
  }

  return result;
}

export function setupCyPoppers(
  cy: cytoscape.Core,
  dag: Dag,
  canvasElement: HTMLElement,
): PopperCleanup {
  const popperMap = makeCyPopperMapFromDag(cy, canvasElement, dag);
  const allPoppers = Array.from(popperMap.values()).flat();

  // Single core listener for pan/zoom/resize — updates all poppers
  const coreUpdateHandler: EventHandler = () => {
    allPoppers.forEach((popper) => popper.update());
  };
  cy.on("pan zoom resize", coreUpdateHandler);

  // Single delegated listener for position changes — updates only the moved element's poppers
  const positionHandler: EventHandler = (event) => {
    const elementId = event.target.id();
    const elementPoppers = popperMap.get(elementId);
    if (elementPoppers) {
      elementPoppers.forEach((popper) => popper.update());
    }
  };
  cy.on("position", "node, edge", positionHandler);

  // Zoom scale handler for CSS transform on popper divs
  const zoomScaleHandler: EventHandler = () => {
    const zoomLevel = cy.zoom();
    const popperInnerDivArray = Array.from(
      canvasElement.getElementsByClassName(POPPER_INNER_DIV_CLASS),
    );
    popperInnerDivArray.forEach((popperInnerDiv) => {
      const popperDivElement = popperInnerDiv as HTMLElement;
      popperDivElement.style.transform = `scale(${zoomLevel})`;
    });
  };

  // Apply current zoom scale immediately, then track future changes
  zoomScaleHandler({} as cytoscape.EventObject);
  cy.on("zoom", zoomScaleHandler);

  // Cleanup function to remove listeners and popper divs created by this setup
  return () => {
    cy.off("pan zoom resize", coreUpdateHandler);
    cy.off("position", "node, edge", positionHandler);
    cy.off("zoom", zoomScaleHandler);
    clearAllPopperDivs(canvasElement);
  };
}
