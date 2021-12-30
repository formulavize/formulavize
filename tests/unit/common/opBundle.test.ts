import { OpBundle } from "common/opBundle"

describe("construction test", () => {
  test("empty bundle", () => {
    const bundleName = "test"
    const bundle = new OpBundle(bundleName)
    expect(bundle.Name).toEqual(bundleName)
    expect(bundle.Operators).toEqual(new Map())
  })

  test("simple bundle", () => {
    const desc1 = {name: 'add', imgUrl: 'test/add'}
    const desc2 = {name: 'subtract', imgUrl: 'test/subtract'}
    const expectedMap = new Map([['add', desc1], ['subtract', desc2]])

    const bundle = new OpBundle("test")
    bundle.addOpDesc(desc1)
    bundle.addOpDesc(desc2)
    expect(bundle.Operators).toEqual(expectedMap)
  })

  test("overwrite a description", () => {
    const desc1 = {name: 'add', imgUrl: 'test/add'}
    const desc2 = {name: 'add', imgUrl: 'test/add2'}
    const expectedMap = new Map([['add', desc2]])

    const bundle = new OpBundle("test")
    bundle.addOpDesc(desc1)
    bundle.addOpDesc(desc2)
    expect(bundle.Operators).toEqual(expectedMap)
  })

  test("remove a description", () => {
    const desc1 = {name: 'add', imgUrl: 'test/add'}

    const bundle = new OpBundle("test")
    bundle.addOpDesc(desc1)
    expect(bundle.removeOpDesc("x")).toEqual(false)
    expect(bundle.removeOpDesc("add")).toEqual(true)
    expect(bundle.Operators).toEqual(new Map())
  })

})