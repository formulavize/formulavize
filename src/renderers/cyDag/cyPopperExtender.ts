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

/**
 * Maps Cytoscape label style properties to CSS equivalents for popper rendering.
 * Properties without a CSS equivalent are omitted (they still apply to ghost nodes).
 * The reason for this mapping is that poppers are regular DOM elements and only understand CSS properties,
 * whereas Cytoscape has its own set of style properties that don't always match CSS.
 * For example, "text-opacity" in Cytoscape corresponds to "opacity" in CSS.
 * This mapping allows us to apply the intended styles to the popper content correctly.
 * Though CSS properties are a richer superset of Cytoscape properties,
 * we restrict styles to only known Cytoscape label style properties to maintain parity
 * between popper-rendered descriptions and ghost-node-rendered descriptions for exporting.
 * If we allowed arbitrary CSS properties, users might use styles that work in poppers but not in exports.
 * We can expand to use CSS properties more fully in the future if we implement
 * a more robust export solution that can handle CSS directly.
 */
const CY_TO_CSS_PROPERTIES = new Map<string, string>([
  // Font properties (same name in both)
  ["font-family", "font-family"],
  ["font-style", "font-style"],
  ["font-weight", "font-weight"],
  ["font-size", "font-size"],
  ["line-height", "line-height"],
  ["color", "color"],
  // Text layout
  // Note: text-halign and text-valign are intentionally excluded.
  // In Cytoscape they control label *position* relative to the node body
  // (e.g. "right" places the label to the right of the node), whereas
  // the CSS equivalents (text-align, vertical-align) control text alignment
  // *within* a block. On ghost nodes (1px body), applying text-halign
  // shifts the entire label off-center. The semantics are incompatible,
  // so these properties are not supported for descriptions.
  ["text-transform", "text-transform"],
  ["text-overflow-wrap", "overflow-wrap"],
  ["text-max-width", "max-width"],
  // Text background
  ["text-background-color", "background-color"],
  ["text-background-padding", "padding"],
  // Text border
  ["text-border-color", "border-color"],
  ["text-border-width", "border-width"],
  ["text-border-style", "border-style"],
  // Visibility
  ["text-opacity", "opacity"],
]);

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
  innerDiv.style.textAlign = "center";

  // add popper class to inner div to allow for manipulation later
  innerDiv.classList.add(POPPER_INNER_DIV_CLASS);
  // Map Cytoscape properties to CSS equivalents for DOM rendering
  descriptionData.descriptionStyleProperties.forEach((value, property) => {
    const cssProp = CY_TO_CSS_PROPERTIES.get(property);
    if (cssProp) {
      innerDiv.style.setProperty(cssProp, value);
    }
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

export function buildGhostNodeStyle(
  descriptionData: DescriptionData,
): Record<string, string | number> {
  const style: Record<string, string | number> = {
    // Hide the node body — only the label should be visible
    "background-opacity": 0,
    "border-width": 0,
    width: 1,
    height: 1,
    // Label configuration
    label: descriptionData.description,
    "text-valign": "center",
    "text-halign": "center",
    "text-wrap": "wrap",
  };

  const props = descriptionData.descriptionStyleProperties;
  props.forEach((value, property) => {
    if (CY_TO_CSS_PROPERTIES.has(property)) {
      style[property] = value;
    }
  });

  // Cytoscape defaults text-border-opacity and text-background-opacity to 0,
  // but in CSS borders/backgrounds are visible as soon as their properties are
  // set. Auto-enable opacity when related properties are present but opacity
  // wasn't explicitly provided.
  const hasBorder =
    props.has("text-border-width") ||
    props.has("text-border-color") ||
    props.has("text-border-style");
  if (hasBorder && !props.has("text-border-opacity")) {
    style["text-border-opacity"] = 1;
  }

  const hasBackground = props.has("text-background-color");
  if (hasBackground && !props.has("text-background-opacity")) {
    style["text-background-opacity"] = 1;
  }

  return style;
}

// Adds invisible "ghost" nodes with description text to ensure descriptions
// are included in canvas-based exports.
// Returns the IDs of the created ghost nodes for later cleanup.
export function addDescriptionGhostNodes(
  cy: cytoscape.Core,
  dag: Dag,
): string[] {
  const descriptionMap = collectDescriptions(cy, dag);
  const ghostIds: string[] = [];

  for (const [id, descriptions] of descriptionMap) {
    const ele = cy.getElementById(id);
    if (ele.empty()) continue;

    const eleBB = ele.boundingBox({ includeLabels: true });
    const centerX = (eleBB.x1 + eleBB.x2) / 2;
    let nextY = eleBB.y2;

    for (let i = 0; i < descriptions.length; i++) {
      const ghostId = `__ghost_desc_${id}_${i}`;
      const ghostNode = cy.add({
        group: "nodes",
        data: { id: ghostId },
      });
      const style = buildGhostNodeStyle(descriptions[i]);
      ghostNode.style(style);
      // Position after styling so Cytoscape computes the label dimensions
      const labelHeight = ghostNode.boundingBox({ includeLabels: true }).h;
      nextY += labelHeight / 2;
      ghostNode.position({ x: centerX, y: nextY });
      nextY += labelHeight / 2;
      ghostIds.push(ghostId);
    }
  }

  return ghostIds;
}
