import cytoscape from 'cytoscape'
import popper from 'cytoscape-popper'
import {
  DESCRIPTION_PROPERTY,
  DESCRIPTION_PREFIX,
  POPPER_INNER_DIV_CLASS,
} from "./constants"
import { Dag, DagElement } from "./dag" 

export type NodeId = string
export type EdgeId = string
export type ElementId = NodeId | EdgeId
export type StyleTag = string
export type Keyword = string

export interface DescriptionData {
  description: string,
  descriptionStyleMap: Map<string, string>
}

export function getDescriptionProperties(styleMap: Map<string, string>): Map<string, string>{
  // get only properties that starts with DESCRIPTION_PREFIX from styleMap and remove the prefix
  // e.g. Map(["description-color", "black"]) -> Map(["color", "black"])
  return new Map(
    [...styleMap.entries()].filter(
      ([key, _]) => key.startsWith(DESCRIPTION_PREFIX)
    ).map(
      ([key, value]) => [key.slice(DESCRIPTION_PREFIX.length), value]
    )
  )
}

export function getDescriptionData(styleMap: Map<string, string>): DescriptionData | null {
  const description = styleMap.get(DESCRIPTION_PROPERTY)
  // return early if there is no description to apply styles to
  if (!description) return null
  const descriptionStyleMap = getDescriptionProperties(styleMap)
  return { description, descriptionStyleMap }
}

export function getStyleDescriptionData(dag: Dag): Map<StyleTag, DescriptionData> {
  return new Map<StyleTag, DescriptionData>(
    Array.from(dag.getFlattenedStyles().entries())
      .map(([styleTag, styleMap]) => [styleTag, getDescriptionData(styleMap)])
      .filter(([_, descriptionData]) => !!descriptionData) as Iterable<[StyleTag, DescriptionData]>
  )
}

export function getNamesWithStyleDescriptionData(
  dag: Dag, styleTagDescriptions: Map<StyleTag, DescriptionData>
): Map<Keyword, DescriptionData>  {
  return new Map<Keyword, DescriptionData>(
    Array.from(dag.getStyleBindings().entries())
      .map(([keyword, styleTags]) => {
        // find the first style tag that has a description (tag usage order takes precedence)
        const usedTag = styleTags.find((tag) => styleTagDescriptions.has(tag))
        if (!usedTag) return null
        return [keyword, styleTagDescriptions.get(usedTag)]
      })
      .filter((entry) => !!entry) as Iterable<[Keyword, DescriptionData]>
  )
}

function getElementDescriptionData(dagElements: DagElement[] ): Map<ElementId, DescriptionData> {
  return new Map<ElementId, DescriptionData>(
    dagElements
      .map((dagElement) => {
        const descriptionData = getDescriptionData(dagElement.styleMap)
        if (!descriptionData) return null
        return [dagElement.id, descriptionData]
      })
      .filter((descriptionData) => !!descriptionData) as Iterable<[ElementId, DescriptionData]>
  )
}

export function getNodeDescriptionData(dag: Dag): Map<NodeId, DescriptionData> {
  return getElementDescriptionData(dag.getNodeList())
}

export function getEdgeDescriptionData(dag: Dag): Map<EdgeId, DescriptionData> {
  return getElementDescriptionData(dag.getEdgeList())
}

function clearAllPopperDivs() {
  const popperDivArray = Array.from(document.getElementsByClassName(POPPER_INNER_DIV_CLASS))
  for (const popperDiv of popperDivArray) {
    popperDiv.parentNode?.removeChild(popperDiv)
  }
}

function makePopperDiv(descriptionData: DescriptionData): HTMLDivElement {
  // create an inner div to separate our styles from popper css properties
  const innerDiv = document.createElement('div')
  // inner div styles required for correct zoom sizing
  innerDiv.style.position = "relative"
  innerDiv.style.transformOrigin = "top"
  innerDiv.style.display = "inline-block"

  // add popper class to inner div to allow for manipulation later
  innerDiv.classList.add(POPPER_INNER_DIV_CLASS)
  // add custom description styles to inner div
  for (const [key, value] of descriptionData.descriptionStyleMap) {
    innerDiv.style.setProperty(key, value)
  }
  
  const text = document.createElement('p')
  text.innerHTML = descriptionData.description.replace(/(?:\r\n|\r|\n)/g, '<br />')
  text.style.margin = "1em"

  innerDiv.appendChild(text)

  // outer div will receive popper css properties
  const outerDiv = document.createElement('div')
  outerDiv.appendChild(innerDiv)

  return outerDiv
}

function addDescriptionPopper(
  cy: cytoscape.Core,
  canvasElement: HTMLElement,
  cySelection: string,
  descriptionData: DescriptionData)
{
  cy.elements(cySelection).forEach((cyElement) => {
    const popperElement = cyElement.popper({
      content: () => {
        const popperDiv = makePopperDiv(descriptionData)
        canvasElement.appendChild(popperDiv)
        return popperDiv
      }
    })
    cy.on("pan zoom resize", () => { popperElement.update() })
  })
}

export function extendCyPopperElements(cy: cytoscape.Core, dag: Dag) {
  clearAllPopperDivs()

  const canvasElement = document.getElementById('canvas') ?? document.body

  const nodeDescriptionData = getNodeDescriptionData(dag)
  nodeDescriptionData.forEach((descriptionData, nodeId) => {
    addDescriptionPopper(cy, canvasElement, `node#${nodeId}`, descriptionData)
  })

  const edgeDescriptionData = getEdgeDescriptionData(dag)
  edgeDescriptionData.forEach((descriptionData, edgeId) => {
    addDescriptionPopper(cy, canvasElement, `edge#${edgeId}`, descriptionData)
  })

  const styleDescriptionData = getStyleDescriptionData(dag)
  const nameDescriptionData = getNamesWithStyleDescriptionData(dag, styleDescriptionData)

  nameDescriptionData.forEach((descriptionData, keyword) => {
    addDescriptionPopper(cy, canvasElement, `[name ='${keyword}']`, descriptionData)
  })

  styleDescriptionData.forEach((descriptionData, styleTag) => {
    addDescriptionPopper(cy, canvasElement, `.${styleTag}`, descriptionData)
  })

  // scale popper divs with zoom level
  cy.on("zoom", () => {
    const zoomLevel = cy.zoom()
    const popperDivArray = Array.from(document.getElementsByClassName(POPPER_INNER_DIV_CLASS))
    for (const popperDiv of popperDivArray) {
      const popperDivElement = popperDiv as HTMLElement;
      popperDivElement.style.transform = `scale(${zoomLevel})`
    }
  })
}
