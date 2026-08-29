import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, shallowRef, nextTick } from "vue";
import { ExportFormat } from "src/compiler/constants";
import { Dag, DagStyle } from "src/compiler/dag";

// Mock the renderer components to avoid cytoscape-svg requiring window
vi.mock("src/renderers/cyDag/CytoscapeRenderer.vue", () => ({
  default: {
    name: "CytoscapeRenderer",
    displayName: "Cytoscape",
    supportedExportFormats: [ExportFormat.PNG, ExportFormat.SVG],
  },
}));

vi.mock("src/renderers/minExample/MinimalExampleRenderer.vue", () => ({
  default: {
    name: "MinimalExampleRenderer",
    displayName: "Minimal Example",
    supportedExportFormats: [ExportFormat.PNG],
  },
}));

import { useRendererRegistry } from "src/composables/useRendererRegistry";

const EMPTY_STYLE: DagStyle = {
  styleTags: [],
  styleProperties: new Map<string, string>(),
};

// Build a dag carrying the renderer directives a recipe would declare,
// in the order they appear in the source.
function makeDagWithDirectives(...rendererNames: string[]): Dag {
  const dag = new Dag("test-dag");
  rendererNames.forEach((rendererName) =>
    dag.addRendererDirective(rendererName, EMPTY_STYLE),
  );
  return dag;
}

describe("useRendererRegistry", () => {
  let scope: ReturnType<typeof effectScope>;

  // Computeds must be created inside an effect scope so their reactive
  // effects are disposed with the test rather than leaking into the next one.
  function setupRegistry(getDag: () => Dag) {
    const registry = scope.run(() => useRendererRegistry(getDag));
    if (!registry) throw new Error("effect scope was stopped before setup");
    return registry;
  }

  beforeEach(() => {
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  describe("renderer selection from renderer directives", () => {
    test("defaults to cytoscape when the dag declares no directive", () => {
      const { activeRendererName, rendererComponent } = setupRegistry(
        () => new Dag("empty-dag"),
      );
      expect(activeRendererName.value).toBe("cytoscape");
      expect(rendererComponent.value.name).toBe("CytoscapeRenderer");
    });

    test("selects the renderer named by the directive", () => {
      const { activeRendererName, rendererComponent } = setupRegistry(() =>
        makeDagWithDirectives("minimal"),
      );
      expect(activeRendererName.value).toBe("minimal");
      expect(rendererComponent.value.name).toBe("MinimalExampleRenderer");
    });

    test("falls back to cytoscape for an unregistered renderer name", () => {
      const { activeRendererName, rendererComponent } = setupRegistry(() =>
        makeDagWithDirectives("madeup"),
      );
      expect(activeRendererName.value).toBe("cytoscape");
      expect(rendererComponent.value.name).toBe("CytoscapeRenderer");
    });

    test("last declared registered renderer wins", () => {
      const { activeRendererName } = setupRegistry(() =>
        makeDagWithDirectives("cytoscape", "minimal"),
      );
      expect(activeRendererName.value).toBe("minimal");
    });

    test("ignores unregistered names declared after a registered one", () => {
      const { activeRendererName } = setupRegistry(() =>
        makeDagWithDirectives("minimal", "madeup"),
      );
      expect(activeRendererName.value).toBe("minimal");
    });

    test("tracks the renderer as the dag changes", async () => {
      const curDag = shallowRef<Dag>(new Dag("empty-dag"));
      const { activeRendererName, rendererComponent } = setupRegistry(
        () => curDag.value,
      );
      expect(rendererComponent.value.name).toBe("CytoscapeRenderer");

      curDag.value = makeDagWithDirectives("minimal");
      await nextTick();

      expect(activeRendererName.value).toBe("minimal");
      expect(rendererComponent.value.name).toBe("MinimalExampleRenderer");
    });
  });

  describe("supportedExportFormats", () => {
    test("returns the active renderer's formats", () => {
      const { supportedExportFormats } = setupRegistry(
        () => new Dag("empty-dag"),
      );
      expect(supportedExportFormats.value).toEqual([
        ExportFormat.PNG,
        ExportFormat.SVG,
      ]);
    });

    test("follows the renderer the directive selects", () => {
      const { supportedExportFormats } = setupRegistry(() =>
        makeDagWithDirectives("minimal"),
      );
      expect(supportedExportFormats.value).toEqual([ExportFormat.PNG]);
    });
  });

  describe("registerRenderer", () => {
    test("makes a new renderer name selectable by directive", async () => {
      const curDag = shallowRef<Dag>(makeDagWithDirectives("custom"));
      const { activeRendererName, rendererComponent, registerRenderer } =
        setupRegistry(() => curDag.value);

      // Not registered yet, so the directive is ignored
      expect(activeRendererName.value).toBe("cytoscape");

      registerRenderer("custom", {
        name: "CustomRenderer",
        displayName: "Custom",
        supportedExportFormats: [ExportFormat.TXT],
      });
      await nextTick();

      expect(activeRendererName.value).toBe("custom");
      expect(rendererComponent.value.name).toBe("CustomRenderer");
    });
  });
});
