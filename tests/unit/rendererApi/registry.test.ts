import { describe, test, expect } from "vitest";
import {
  ExportFormat,
  RendererPlugin,
  RendererRegistry,
} from "src/rendererApi";
import { Dag, DagStyle } from "src/compiler/dag";

const EMPTY_STYLE: DagStyle = {
  styleTags: [],
  styleProperties: new Map<string, string>(),
};

function makePlugin(name: string): RendererPlugin {
  return {
    name,
    displayName: name,
    component: { name: `${name}-component` },
    supportedExportFormats: [ExportFormat.PNG],
  };
}

// Build a dag carrying the renderer directives a recipe would declare,
// in the order they appear in the source.
function makeDag(...rendererNames: string[]): Dag {
  const dag = new Dag("test-dag");
  rendererNames.forEach((name) => dag.addRendererDirective(name, EMPTY_STYLE));
  return dag;
}

const alpha = makePlugin("alpha");
const beta = makePlugin("beta");

describe("registration", () => {
  test("registers the plugins given at construction", () => {
    const registry = new RendererRegistry([alpha, beta]);
    expect(registry.names()).toEqual(["alpha", "beta"]);
    expect(registry.get("alpha")).toBe(alpha);
    expect(registry.has("beta")).toBe(true);
    expect(registry.has("gamma")).toBe(false);
  });

  test("register adds a plugin after construction", () => {
    const registry = new RendererRegistry([alpha]);
    registry.register(beta);
    expect(registry.list()).toEqual([alpha, beta]);
  });

  test("re-registering a name replaces the plugin under it", () => {
    const replacement = makePlugin("alpha");
    const registry = new RendererRegistry([alpha, beta]);
    registry.register(replacement);
    expect(registry.get("alpha")).toBe(replacement);
    expect(registry.names()).toEqual(["alpha", "beta"]);
  });
});

describe("the default renderer", () => {
  test("is the first registered when none is named", () => {
    expect(new RendererRegistry([alpha, beta]).defaultPlugin).toBe(alpha);
  });

  test("is the named one when given", () => {
    expect(new RendererRegistry([alpha, beta], "beta").defaultPlugin).toBe(
      beta,
    );
  });

  test("is undefined for an empty registry", () => {
    expect(new RendererRegistry().defaultPlugin).toBeUndefined();
  });
});

describe("resolveFor", () => {
  const registry = new RendererRegistry([alpha, beta]);

  test("falls back to the default when the dag names no renderer", () => {
    expect(registry.resolveFor(new Dag("empty"))).toBe(alpha);
  });

  test("selects the renderer the directive names", () => {
    expect(registry.resolveFor(makeDag("beta"))).toBe(beta);
  });

  test("the last declared registered renderer wins", () => {
    expect(registry.resolveFor(makeDag("beta", "alpha"))).toBe(alpha);
  });

  test("skips names that are not registered", () => {
    expect(registry.resolveFor(makeDag("beta", "madeup"))).toBe(beta);
  });

  test("falls back to the default when nothing named is registered", () => {
    expect(registry.resolveFor(makeDag("madeup"))).toBe(alpha);
  });

  test("resolves to nothing when no renderer is registered at all", () => {
    expect(new RendererRegistry().resolveFor(makeDag("alpha"))).toBeUndefined();
  });
});
