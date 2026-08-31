import { describe, test, expect } from "vitest";
import {
  ExportFormat,
  RendererDescriptor,
  RendererRegistry,
} from "src/rendererApi";
import { headlessRendererDescriptors } from "src/renderers/headlessRenderers";
import { Dag, DagStyle } from "src/compiler/dag";

const EMPTY_STYLE: DagStyle = {
  styleTags: [],
  styleProperties: new Map<string, string>(),
};

function makeDag(...rendererNames: string[]): Dag {
  const dag = new Dag("test-dag");
  rendererNames.forEach((name) => dag.addRendererDirective(name, EMPTY_STYLE));
  return dag;
}

const registry = new RendererRegistry(headlessRendererDescriptors);

describe("what the CLI can draw", () => {
  test("every shipped renderer renders headlessly", () => {
    expect(headlessRendererDescriptors.length).toBeGreaterThan(0);
    for (const descriptor of headlessRendererDescriptors) {
      expect(descriptor.renderHeadless).toBeTypeOf("function");
    }
  });

  test("cytoscape is the default", () => {
    expect(registry.resolveFor(makeDag())?.name).toBe("cytoscape");
  });

  test("a directive selects another headless renderer", () => {
    expect(registry.resolveFor(makeDag("minimal"))?.name).toBe("minimal");
  });

  test("an unregistered name still falls back to the default", () => {
    expect(registry.resolveFor(makeDag("madeup"))?.name).toBe("cytoscape");
  });

  test("no descriptor carries a Vue component", () => {
    // Loading one would drag the browser rendering stack into the CLI.
    for (const descriptor of headlessRendererDescriptors) {
      expect(descriptor).not.toHaveProperty("component");
    }
  });

  test("a browser-only renderer resolves rather than being skipped", () => {
    // Nothing shipped is browser-only today, but the mechanism has to hold:
    // a recipe asking for such a renderer must resolve to it, so the CLI can
    // report that it cannot draw it instead of quietly using another.
    const browserOnly: RendererDescriptor = {
      name: "browser-only",
      displayName: "Browser Only",
      supportedExportFormats: [ExportFormat.PNG],
    };
    const withBrowserOnly = new RendererRegistry([
      ...headlessRendererDescriptors,
      browserOnly,
    ]);

    const resolved = withBrowserOnly.resolveFor(makeDag("browser-only"));
    expect(resolved?.name).toBe("browser-only");
    expect(resolved?.renderHeadless).toBeUndefined();
  });
});
