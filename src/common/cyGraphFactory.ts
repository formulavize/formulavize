import { EdgeDefinition, ElementsDefinition, NodeDefinition, Stylesheet } from 'cytoscape'
import { Dag } from "./dag" 

export function makeCyNodes(dag : Dag): NodeDefinition[] {
  return dag.getNodeList().map((node) => (
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
    .filter(node => node.styleMap.size > 0)
    .map((node) => ({
      selector: `node#${node.id}`,
      style: Object.fromEntries(node.styleMap)
    }))
}

export function makeEdgeStyleSheets(dag: Dag): Stylesheet[] {
  return dag.getEdgeList()
    .filter(edge => edge.styleMap.size > 0)
    .map((edge) => ({
      selector: `edge#${edge.id}`,
      style: Object.fromEntries(edge.styleMap)
    }))
}

export function makeClassStyleSheets(dag: Dag): Stylesheet[] {
  const classStyles: Stylesheet[] = []
  dag.getFlattenedStyles().forEach((styleMap, styleName) => {
    classStyles.push({
      selector: '.' + styleName,
      style: Object.fromEntries(styleMap)
    })
  })
  return classStyles
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

  return workingStylesheets
}