import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { effectScope, shallowRef, nextTick } from "vue";
import { ExportFormat, RendererPlugin } from "src/rendererApi";
import { Dag, DagStyle } from "src/compiler/dag";
import { useRendererRegistry } from "src/composables/useRendererRegistry";

// Plain stand-ins for the shipped renderers. The composable only ever reads a
// plugin, never mounts it, so nothing here needs to be a real Vue component --
// which also keeps cytoscape (and its need for a window) out of this test.
function makePlugin(
  name: string,
  supportedExportFormats: readonly ExportFormat[],
): RendererPlugin {
  return {
    name,
    displayName: name,
    component: { name: `${name}-component` },
    supportedExportFormats,
  };
}

const cytoscapeStub = makePlugin("cytoscape", [
  ExportFormat.PNG,
  ExportFormat.SVG,
]);
const minimalStub = makePlugin("minimal", [ExportFormat.PNG]);
const testPlugins = [cytoscapeStub, minimalStub];

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
    const registry = scope.run(() => useRendererRegistry(getDag, testPlugins));
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
    test("defaults to the first plugin when the dag declares no directive", () => {
      const { activeRendererName, rendererComponent } = setupRegistry(
        () => new Dag("empty-dag"),
      );
      expect(activeRendererName.value).toBe("cytoscape");
      expect(rendererComponent.value).toBe(cytoscapeStub.component);
    });

    test("selects the renderer named by the directive", () => {
      const { activeRendererName, rendererComponent } = setupRegistry(() =>
        makeDagWithDirectives("minimal"),
      );
      expect(activeRendererName.value).toBe("minimal");
      expect(rendererComponent.value).toBe(minimalStub.component);
    });

    test("falls back to the default for an unregistered renderer name", () => {
      const { activeRendererName, rendererComponent } = setupRegistry(() =>
        makeDagWithDirectives("madeup"),
      );
      expect(activeRendererName.value).toBe("cytoscape");
      expect(rendererComponent.value).toBe(cytoscapeStub.component);
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
      expect(rendererComponent.value).toBe(cytoscapeStub.component);

      curDag.value = makeDagWithDirectives("minimal");
      await nextTick();

      expect(activeRendererName.value).toBe("minimal");
      expect(rendererComponent.value).toBe(minimalStub.component);
    });

    test("exposes the active plugin itself", () => {
      const { activePlugin } = setupRegistry(() =>
        makeDagWithDirectives("minimal"),
      );
      expect(activePlugin.value).toBe(minimalStub);
    });
  });

  describe("rendererNames", () => {
    test("lists every registered renderer", () => {
      const { rendererNames } = setupRegistry(() => new Dag("empty-dag"));
      expect(rendererNames.value).toEqual(["cytoscape", "minimal"]);
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
      const {
        activeRendererName,
        rendererComponent,
        rendererNames,
        registerRenderer,
      } = setupRegistry(() => curDag.value);

      // Not registered yet, so the directive is ignored
      expect(activeRendererName.value).toBe("cytoscape");

      const customPlugin = makePlugin("custom", [ExportFormat.TXT]);
      registerRenderer(customPlugin);
      await nextTick();

      expect(activeRendererName.value).toBe("custom");
      expect(rendererComponent.value).toBe(customPlugin.component);
      expect(rendererNames.value).toContain("custom");
    });
  });
});
