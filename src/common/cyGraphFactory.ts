import { EdgeDefinition, ElementsDefinition, NodeDefinition, Stylesheet } from 'cytoscape'
import { Dag } from "./dag" 

export function makeCyNodes(dag : Dag): NodeDefinition[] {
  return dag.getNodeList().map((node) => (
    { data: { id: node.id } }
  ))
}

export function makeCyEdges(dag: Dag): EdgeDefinition[] {
  return dag.getEdgeList().map((edge) => (
    {
      data: {
        id: edge.id,
        source: edge.srcNodeId,
        target: edge.destNodeId
      }
    }
  ))
}

export function makeCyElements(dag: Dag): ElementsDefinition {
  const nodeList = makeCyNodes(dag)
  const edgeList = makeCyEdges(dag)
  return { nodes: nodeList, edges: edgeList }
}

export function makeNodeLabelStylesheets(dag: Dag): Stylesheet[] {
  return dag.getNodeList().map((node) => (
    { 
      selector: `node#${node.id}`,
      style: { "label": node.name }
    }
  ))
}

export function makeCyStylesheets(dag: Dag): Stylesheet[] {
  const baseStylesheets : Stylesheet[] = [
    { selector: "edge",
      style: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle"
      }
    }
  ]
  const labelStyles = makeNodeLabelStylesheets(dag)
  return baseStylesheets.concat(labelStyles)
}