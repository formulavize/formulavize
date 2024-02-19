import { describe, test, expect } from 'vitest'
import {
  filterCytoscapeProperties, makeCyNodes, makeCyEdges,
  makeNodeStylesheets, makeEdgeStyleSheets, makeClassStyleSheets, makeNameStyleSheets
} from '../../../src/common/cyGraphFactory'
import { LABEL_PROPERTY, DESCRIPTION_PROPERTY } from '../../../src/common/constants'
import { Dag } from '../../../src/common/dag'

describe("filters for cytoscape properties", () => {
  test("filters out description", () => {
    const testMap = new Map<string, string>([
      [LABEL_PROPERTY, "label"],
      [DESCRIPTION_PROPERTY, "description"],
      ["a", "1"],
      ["b", "2"],
    ])
    const expectedMap = new Map<string, string>([
      [LABEL_PROPERTY, "label"],
      ["a", "1"],
      ["b", "2"],
    ])
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap)
  })
})

describe("makes cytoscape elements", () => {
  test("with two nodes", () => {
    const testDag = new Dag()
    testDag.addNode({
      id: "idX", name: "nameX",
      styleTags: [], styleMap: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: ["s", "t"], styleMap: new Map<string, string>([["a", "1"]]),
    })
    const expectedCyNodes = [
      { data: { id: "idX", name: "nameX"} },
      { data: { id: "idY", name: "nameY"}, classes:"s t" }
    ]
    expect(makeCyNodes(testDag)).toEqual(expectedCyNodes)
  })
  test("with one edge", () => {
    const testDag = new Dag()
    testDag.addNode({
      id: "idX", name: "nameX",
      styleTags: [], styleMap: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: [], styleMap: new Map<string, string>(),
    })
    testDag.addEdge({
      id: "idZ", name: "nameZ", srcNodeId: "idX", destNodeId: "idY",
      styleTags: ["s", "t"],
      styleMap: new Map<string, string>([["a", "1"]]),
    })
    const expectedCyEdges = [{
      data: {
        id: "idZ", name: "nameZ",
        source: "idX", target: "idY",
      },
      classes: "s t"
    }]
    expect(makeCyEdges(testDag)).toEqual(expectedCyEdges)
  })
})

describe("makes cytoscape stylesheets", () => {
  test("node styles", () => {
    const testDag = new Dag()
    testDag.addNode({
      id: "idX", name: "nameX",
      styleTags: ["s"], styleMap: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: [], styleMap: new Map<string, string>([["a", "1"]]),
    })
    const expectedCyNodeStyles= [{
      selector: "node#idY",
      style: {"a": "1"}
    }]
    expect(makeNodeStylesheets(testDag)).toEqual(expectedCyNodeStyles)
  })
  test("edge styles", () => {
    const testDag = new Dag()
    testDag.addNode({
      id: "idX", name: "nameX",
      styleTags: [], styleMap: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: [], styleMap: new Map<string, string>(),
    })
    testDag.addEdge({
      id: "idZ", name: "nameZ", srcNodeId: "idX", destNodeId: "idY",
      styleTags: ["s"],
      styleMap: new Map<string, string>([["a", "1"]]),
    })
    const expectedCyEdgeStyles= [{
      selector: "edge#idZ",
      style: {"a": "1"}
    }]
    expect(makeEdgeStyleSheets(testDag)).toEqual(expectedCyEdgeStyles)
  })
  test("class styles", () => {
    const testDag = new Dag()
    testDag.addStyle("s", new Map<string, string>([["a", "1"], ["b", "2"]]))
    const expectedCyClassStyles= [{
      selector: ".s",
      style: {"a": "1", "b": "2"}
    }]
    expect(makeClassStyleSheets(testDag)).toEqual(expectedCyClassStyles)
  })
  test("name style on undeclared styleTags", () => {
    const testDag = new Dag()
    testDag.addStyleBinding("x", ["a", "b"])
    expect(makeNameStyleSheets(testDag)).toEqual([])
  })
  test("name styles", () => {
    const testDag = new Dag()
    testDag.addStyleBinding("x", ["a", "b"])
    testDag.addStyle("a", new Map<string, string>([["i", "1"]]))
    testDag.addStyle("b", new Map<string, string>([["j", "2"], ["k", "3"]]))
    const expectedCyNameStyles= [
      {
        selector: "[name ='x']",
        style: {"i": "1"}
      },
      {
        selector: "[name ='x']",
        style: {"j": "2", "k":"3"}
      },
    ]
    expect(makeNameStyleSheets(testDag)).toEqual(expectedCyNameStyles)
  })

})
