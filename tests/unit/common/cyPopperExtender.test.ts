import { describe, test, expect } from 'vitest'
import {
  getStyleDescriptions,
  getNamesWithStyleDescriptions,
  getNodeDescriptions,
  getEdgeDescriptions
} from '../../../src/common/cyPopperExtender'
import { DESCRIPTION_PROPERTY } from '../../../src/common/constants'
import { Dag } from '../../../src/common/dag'

describe("makes style descriptions", () => {
  test("no matching styles", () => {
    const testDag = new Dag()
    testDag.addStyle("empty", new Map<string, string>() )
    testDag.addStyle("x", new Map<string, string>([["color","red"]]) )

    const expectedMap = new Map<string, string>()
    expect(getStyleDescriptions(testDag)).toEqual(expectedMap)
  })
  test("two matching styles", () => {
    const testDag = new Dag()
    testDag.addStyle("empty", new Map<string, string>() )
    testDag.addStyle("x", new Map<string, string>([[DESCRIPTION_PROPERTY,"d1"]]) )
    testDag.addStyle("y", new Map<string, string>([[DESCRIPTION_PROPERTY,"d2"]]) )

    const expectedMap = new Map<string, string>([["x", "d1"], ["y", "d2"]])
    expect(getStyleDescriptions(testDag)).toEqual(expectedMap)
  })
})

describe("makes name descriptions", () => {
  test("style with description not bound", () => {
    const styleDescriptions = new Map<string, string>([["x", "1"]])
    const testDag = new Dag()
    testDag.addStyleBinding("name", ["y"])

    const expectedMap = new Map<string, string>()
    expect(getNamesWithStyleDescriptions(testDag, styleDescriptions)).toEqual(expectedMap)
  })
  test("bound name with two matching styles", () => {
    const styleDescriptions = new Map<string, string>([["x", "1"], ["y", "2"]])
    const testDag = new Dag()
    testDag.addStyleBinding("name", ["y", "x"])

    // usage order takes precedence
    const expectedMap = new Map<string, string>([["name", "2"]])
    expect(getNamesWithStyleDescriptions(testDag, styleDescriptions)).toEqual(expectedMap)
  })
  test("two names with bindings to the same style", () => {
    const styleDescriptions = new Map<string, string>([["x", "1"]])
    const testDag = new Dag()
    testDag.addStyleBinding("name1", ["x"])
    testDag.addStyleBinding("name2", ["x"])

    const expectedMap = new Map<string, string>([["name1", "1"], ["name2", "1"]])
    expect(getNamesWithStyleDescriptions(testDag, styleDescriptions)).toEqual(expectedMap)
  })
  test("two names with bindings to different styles", () => {
    const styleDescriptions = new Map<string, string>([["x", "1"], ["y", "2"]])
    const testDag = new Dag()
    testDag.addStyleBinding("name1", ["x"])
    testDag.addStyleBinding("name2", ["y"])

    const expectedMap = new Map<string, string>([["name1", "1"], ["name2", "2"]])
    expect(getNamesWithStyleDescriptions(testDag, styleDescriptions)).toEqual(expectedMap)
  })
})

describe("makes element descriptions", () => {
  test("no matching nodes", () => {
    const testDag = new Dag()
    testDag.addNode({
      id: "idX", name: "nameX",
      styleTags: [], styleMap: new Map<string, string>([["a", "1"]]),
    })

    const expectedMap = new Map<string, string>()
    expect(getNodeDescriptions(testDag)).toEqual(expectedMap)
  })
  test("two matching nodes", () => {
    const testDag = new Dag()
    testDag.addNode({
      id: "idX", name: "nameX",
      styleTags: [], styleMap: new Map<string, string>([[DESCRIPTION_PROPERTY, "1"]]),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: [], styleMap: new Map<string, string>([[DESCRIPTION_PROPERTY, "2"]]),
    })

    const expectedMap = new Map<string, string>([["idX", "1"], ["idY", "2"]])
    expect(getNodeDescriptions(testDag)).toEqual(expectedMap)
  })
  test("no matching edges", () => {
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
      id: "id1", name: "name1", srcNodeId: "idX", destNodeId: "idY",
      styleTags: ["s", "t"],
      styleMap: new Map<string, string>([["a", "1"]]),
    })

    const expectedMap = new Map<string, string>()
    expect(getEdgeDescriptions(testDag)).toEqual(expectedMap)
  })
  test("two matching edges", () => {
    const testDag = new Dag()
    testDag.addNode({
      id: "idX", name: "nameX",
      styleTags: [], styleMap: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idY", name: "nameY",
      styleTags: [], styleMap: new Map<string, string>(),
    })
    testDag.addNode({
      id: "idZ", name: "nameZ",
      styleTags: [], styleMap: new Map<string, string>(),
    })
    testDag.addEdge({
      id: "id1", name: "name1", srcNodeId: "idX", destNodeId: "idZ",
      styleTags: [],
      styleMap: new Map<string, string>([[DESCRIPTION_PROPERTY, "1"]]),
    })
    testDag.addEdge({
      id: "id2", name: "name2", srcNodeId: "idY", destNodeId: "idZ",
      styleTags: [],
      styleMap: new Map<string, string>([[DESCRIPTION_PROPERTY, "2"]]),
    })

    const expectedMap = new Map<string, string>([["id1", "1"], ["id2", "2"]])
    expect(getEdgeDescriptions(testDag)).toEqual(expectedMap)
  })
})
