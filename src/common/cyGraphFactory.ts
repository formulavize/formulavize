import { EdgeDefinition, ElementsDefinition, NodeDefinition, Stylesheet } from 'cytoscape'
import { DESCRIPTION_PROPERTY } from './constants'
import { Dag, StyleProperties } from "./dag"

// a list of known property prefixes that should not be passed to cytoscape
const NON_CYTOSCAPE_PROPERTY_PREFIXES: string[] = [
  DESCRIPTION_PROPERTY // this captures description and all description-*
]

export function keyStartsWithNonCytoscapePrefix(key: string): boolean {
  return NON_CYTOSCAPE_PROPERTY_PREFIXES.some(
    (nonCytoscapePropertyPrefix) => key.startsWith(nonCytoscapePropertyPrefix)
  )
}

export function filterCytoscapeProperties(styleProperties: StyleProperties): StyleProperties{
  return new Map(
    [...styleProperties.entries()].filter(
      ([key, _]) => !keyStartsWithNonCytoscapePrefix(key)
    )
  )
}

export function makeCyNodes(dag : Dag): NodeDefinition[] {
  return dag.getNodeList().map(node => (
    { 
      data: { id: node.id, name: node.name },
      ...(node.styleTags.length > 0 && {
        classes: node.styleTags.join(' ')
      }),
    }
  ))
}

export function makeCyEdges(dag: Dag): EdgeDefinition[] {
  return dag.getEdgeList().map((edge) => (
    {
      data: {
        id: edge.id,
        source: edge.srcNodeId,
        target: edge.destNodeId,
        name: edge.name,
      },
      ...(edge.styleTags.length > 0 && {
        classes: edge.styleTags.join(' ')
      }),
    }
  ))
}

export function makeCyElements(dag: Dag): ElementsDefinition {
  const nodeList = makeCyNodes(dag)
  const edgeList = makeCyEdges(dag)
  return { nodes: nodeList, edges: edgeList }
}

export function makeNodeStylesheets(dag: Dag): Stylesheet[] {
  return dag.getNodeList()
    .filter(node => node.styleProperties.size > 0)
    .map(node => ({
      selector: `node#${node.id}`,
      style: Object.fromEntries(filterCytoscapeProperties(node.styleProperties))
    }))
}

export function makeEdgeStyleSheets(dag: Dag): Stylesheet[] {
  return dag.getEdgeList()
    .filter(edge => edge.styleProperties.size > 0)
    .map(edge => ({
      selector: `edge#${edge.id}`,
      style: Object.fromEntries(filterCytoscapeProperties(edge.styleProperties))
    }))
}

export function makeClassStyleSheets(dag: Dag): Stylesheet[] {
  const classStyles: Stylesheet[] = []
  dag.getFlattenedStyles().forEach((styleProperties, styleTag) => {
    classStyles.push({
      selector: '.' + styleTag,
      style: Object.fromEntries(filterCytoscapeProperties(styleProperties))
    })
  })
  return classStyles
}

export function makeNameStyleSheets(dag: Dag): Stylesheet[] {
  const nameStyles: Stylesheet[] = []
  const flatStyleMap = dag.getFlattenedStyles()
  dag.getStyleBindings().forEach((styleTags, keyword) => {
    styleTags.forEach(styleTag => {
      const styleProperties = flatStyleMap.get(styleTag)
      if (styleProperties) {
        nameStyles.push({
          selector: `[name ='${keyword}']`,
          style: Object.fromEntries(filterCytoscapeProperties(styleProperties))
        })
      } else {
        console.log(`keyword ${keyword} could not be bound to ${styleTag}`)
      }
    })
  })
  return nameStyles
}

export function makeCyStylesheets(dag: Dag): Stylesheet[] {
  const workingStylesheets : Stylesheet[] = [
    { 
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
      }
    },
    { 
      selector: "node",
      style: {
        "label": "data(name)",
        "text-valign": "bottom",
        "text-wrap": "wrap",
      }
    },
  ]
  const nodeStyles = makeNodeStylesheets(dag)
  workingStylesheets.push(...nodeStyles)

  const edgeStyles = makeEdgeStyleSheets(dag)
  workingStylesheets.push(...edgeStyles)

  const classStyles = makeClassStyleSheets(dag)
  workingStylesheets.push(...classStyles)

  const nameStyles = makeNameStyleSheets(dag)
  workingStylesheets.push(...nameStyles)

  return workingStylesheets
}
