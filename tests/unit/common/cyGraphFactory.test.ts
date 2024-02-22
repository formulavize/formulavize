import { describe, test, expect } from 'vitest'
import {
  keyStartsWithNonCytoscapePrefix, filterCytoscapeProperties, makeCyNodes, makeCyEdges,
  makeNodeStylesheets, makeEdgeStyleSheets, makeClassStyleSheets, makeNameStyleSheets
} from '../../../src/common/cyGraphFactory'
import { DESCRIPTION_PROPERTY } from '../../../src/common/constants'
import { Dag } from '../../../src/common/dag'

describe("filters out non-cytoscape properties", () => {
  test("property with non-cytoscape prefix", () => {
    expect(keyStartsWithNonCytoscapePrefix(DESCRIPTION_PROPERTY+"-font-size")).toBe(true)
  })
  test("property without non-cytoscape prefix", () => {
    expect(keyStartsWithNonCytoscapePrefix("test")).toBe(false)
  })
  test("empty map", () => {
    const testMap = new Map<string, string>()
    const expectedMap = new Map<string, string>()
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap)
  })
  test("map without description property", () => {
    const testMap = new Map<string, string>([["a", "1"], ["b", "2"]])
    const expectedMap = new Map<string, string>([["a", "1"], ["b", "2"]])
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap)
  })
  test("map with only description property", () => {
    const testMap = new Map<string, string>([[DESCRIPTION_PROPERTY, "desc"]])
    const expectedMap = new Map<string, string>()
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap)
  })
  test("map with multiple properties and a description property", () => {
    const testMap = new Map<string, string>([["a", "1"], [DESCRIPTION_PROPERTY, "desc"], ["b", "2"]])
    const expectedMap = new Map<string, string>([["a", "1"], ["b", "2"]])
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap)
  })
  test("map with multiple properties and a prefixed description properties", () => {
    const testMap = new Map<string, string>(
      [["a", "1"], [DESCRIPTION_PROPERTY, "desc"], [DESCRIPTION_PROPERTY+"-font-size", "12"]]
    )
    const expectedMap = new Map<string, string>([["a", "1"]])
    expect(filterCytoscapeProperties(testMap)).toEqual(expectedMap)
  })
})

describe("makes cytoscape elements", () => {
  test("with two nodes", () => {
    const testDag = new Dag()
    testDag.addNode({
      id: "idX", name: "nameX",
      styleTags: [], styleProperties: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: ["s", "t"], styleProperties: new Map<string, string>([["a", "1"]]),
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
      styleTags: [], styleProperties: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: [], styleProperties: new Map<string, string>(),
    })
    testDag.addEdge({
      id: "idZ", name: "nameZ", srcNodeId: "idX", destNodeId: "idY",
      styleTags: ["s", "t"],
      styleProperties: new Map<string, string>([["a", "1"]]),
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
      styleTags: ["s"], styleProperties: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: [], styleProperties: new Map<string, string>([["a", "1"]]),
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
      styleTags: [], styleProperties: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: [], styleProperties: new Map<string, string>(),
    })
    testDag.addEdge({
      id: "idZ", name: "nameZ", srcNodeId: "idX", destNodeId: "idY",
      styleTags: ["s"],
      styleProperties: new Map<string, string>([["a", "1"]]),
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
