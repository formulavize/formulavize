import cytoscape from 'cytoscape'
import popper from 'cytoscape-popper'
import { DESCRIPTION_PROPERTY } from "./constants"
import { Dag, DagElement } from "./dag" 

export function getStyleDescriptions(dag: Dag): Map<string, string> {
  const styeTagToDesription: Map<string, string> = new Map<string, string>()
  dag.getFlattenedStyles().forEach((styleMap, styleName) => {
    const description = styleMap.get(DESCRIPTION_PROPERTY)
    if (description !== undefined) {
      styeTagToDesription.set(styleName, description)
    }
  })
  return styeTagToDesription
}

export function getNamesWithStyleDescriptions(dag: Dag, styleDesc: Map<string, string>): Map<string, string>  {
  const nameToDescription: Map<string, string> = new Map<string, string>()
  // usage order takes precedence - take first style with a description
  dag.getStyleBindings().forEach((styleTags, keyword) => {
    const usedTag = styleTags.find((tag) => styleDesc.has(tag))
    if (usedTag !== undefined) {
      nameToDescription.set(keyword, styleDesc.get(usedTag) ?? "")
    }
  })
  return nameToDescription
}

function getElementDescriptions(dagElements: DagElement[] ): Map<string, string> {
  const elementIdToDescription: Map<string, string> = new Map<string, string>()
  dagElements.forEach((dagElement) => {
    const description = dagElement.styleMap.get(DESCRIPTION_PROPERTY)
    if (description !== undefined) {
      elementIdToDescription.set(dagElement.id, description)
    }
  })
  return elementIdToDescription
}

export function getNodeDescriptions(dag: Dag): Map<string, string> {
  return getElementDescriptions(dag.getNodeList())
}

export function getEdgeDescriptions(dag: Dag): Map<string, string> {
  return getElementDescriptions(dag.getEdgeList())
}

function clearAllPopperDivs() {
  const popperDivArr = Array.from(document.getElementsByClassName('popper-div'))
  for (const popperDiv of popperDivArr) {
    popperDiv.parentNode?.removeChild(popperDiv)
  }
}

function makePopperDiv(description: string): HTMLDivElement {
  const div = document.createElement('div')
  div.classList.add('popper-div')
  
  const text = document.createElement('p')
  text.innerHTML = description.replace(/(?:\r\n|\r|\n)/g, '<br />');

  div.appendChild(text)
  return div
}

function addDescriptionPopper(
  cy: cytoscape.Core,
  canvasElement: HTMLElement,
  cySelection: string,
  description: string)
{
  cy.elements(cySelection).forEach((cyElement) => {
    const popperElement = cyElement.popper({
      content: () => {
        const popperDiv = makePopperDiv(description)
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

  const nodeDescriptions = getNodeDescriptions(dag)
  nodeDescriptions.forEach((description, nodeId) => {
    addDescriptionPopper(cy, canvasElement, `node#${nodeId}`, description)
  })

  const edgeDescriptions = getEdgeDescriptions(dag)
  edgeDescriptions.forEach((description, edgeId) => {
    addDescriptionPopper(cy, canvasElement, `edge#${edgeId}`, description)
  })

  const styleDescriptions = getStyleDescriptions(dag)
  const nameDescriptions = getNamesWithStyleDescriptions(dag, styleDescriptions)

  nameDescriptions.forEach((description, keyword) => {
    addDescriptionPopper(cy, canvasElement, `[name ='${keyword}']`, description)
  })

  styleDescriptions.forEach((description, styleTag) => {
    addDescriptionPopper(cy, canvasElement, `.${styleTag}`, description)
  })
}
