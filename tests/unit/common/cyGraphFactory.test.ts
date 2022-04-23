import { makeCyNodes, makeCyEdges, makeNodeLabelStylesheets} from 'common/cyGraphFactory'
import { Dag } from 'common/dag'

describe("makes cytoscape nodes", () => {
  test("with two nodes", () => {
    let testDag = new Dag()
    testDag.addNode({id :"idX", name: "nameX"})
    testDag.addNode({id :"idY", name: "nameY"})
    const expectedCyNodes = [
      { data: { id: "idX"} },
      { data: { id: "idY"} }
    ]
    expect(makeCyNodes(testDag)).toEqual(expectedCyNodes)
  })
})

describe("makes cytoscape edges", () => {
  test("with one edge", () => {
    let testDag = new Dag()
    testDag.addNode({id :"idX", name: "nameX"})
    testDag.addNode({id :"idY", name: "nameY"})
    testDag.addEdge({
      id :"idZ", name: "nameZ", srcNodeId: "idX", destNodeId: "idY"
    })
    const expectedCyEdges = [
      { data: { id: "idZ", source: "idX", target: "idY" } }
    ]
    expect(makeCyEdges(testDag)).toEqual(expectedCyEdges)
  })
})

describe("makes cytoscape stylesheets", () => {
  test("with one node label", () => {
    let testDag = new Dag()
    testDag.addNode({id :"idX", name: "nameX"})
    const expectedCyStyleSheets = [
      { selector: "node#idX", style: { label: "nameX" } }
    ]
    expect(makeNodeLabelStylesheets(testDag)).toEqual(expectedCyStyleSheets)
  })
})