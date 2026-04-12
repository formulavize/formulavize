import { describe, test, expect, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import { ExportFormat } from "src/compiler/constants";

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

describe("useRendererRegistry", () => {
  let scope: ReturnType<typeof effectScope>;

  test("initializes with cytoscape as default renderer", () => {
    scope = effectScope();
    scope.run(() => {
      const { selectedRenderer } = useRendererRegistry();
      expect(selectedRenderer.value).toBe("cytoscape");
    });
    scope.stop();
  });

  test("initializes with custom default renderer", () => {
    scope = effectScope();
    scope.run(() => {
      const { selectedRenderer } = useRendererRegistry("minimal");
      expect(selectedRenderer.value).toBe("minimal");
    });
    scope.stop();
  });

  test("registers default renderers with display names", () => {
    scope = effectScope();
    scope.run(() => {
      const { rendererOptions } = useRendererRegistry();
      const options = rendererOptions.value;
      expect(options).toHaveLength(2);
      expect(options.map((o) => o.id)).toContain("cytoscape");
      expect(options.map((o) => o.id)).toContain("minimal");
      options.forEach((opt) => {
        expect(opt.name).toBeTruthy();
      });
    });
    scope.stop();
  });

  test("renderer display names are correct", () => {
    scope = effectScope();
    scope.run(() => {
      const { rendererOptions } = useRendererRegistry();
      const cytoscape = rendererOptions.value.find((o) => o.id === "cytoscape");
      const minimal = rendererOptions.value.find((o) => o.id === "minimal");
      expect(cytoscape?.name).toBe("Cytoscape");
      expect(minimal?.name).toBe("Minimal Example");
    });
    scope.stop();
  });

  test("switching renderer updates rendererComponent", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const { selectedRenderer, rendererComponent } = useRendererRegistry();
      const initialComponent = rendererComponent.value;

      selectedRenderer.value = "minimal";
      await nextTick();

      expect(rendererComponent.value).not.toBe(initialComponent);
    });
    scope.stop();
  });

  test("switching renderer calls onRendererChanged callback", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const callback = vi.fn();
      const { selectedRenderer } = useRendererRegistry("cytoscape", callback);

      selectedRenderer.value = "minimal";
      await nextTick();

      expect(callback).toHaveBeenCalledTimes(1);
    });
    scope.stop();
  });

  test("switching to invalid renderer logs error and keeps current", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { selectedRenderer, rendererComponent } = useRendererRegistry();
      const initialComponent = rendererComponent.value;

      selectedRenderer.value = "nonexistent";
      await nextTick();

      expect(errorSpy).toHaveBeenCalledWith(
        'Renderer with id "nonexistent" not found',
      );
      expect(rendererComponent.value).toBe(initialComponent);
      errorSpy.mockRestore();
    });
    scope.stop();
  });

  test("invalid renderer does not call onRendererChanged", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const callback = vi.fn();
      const { selectedRenderer } = useRendererRegistry("cytoscape", callback);

      selectedRenderer.value = "nonexistent";
      await nextTick();

      expect(callback).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
    scope.stop();
  });

  test("supportedExportFormats reflects current renderer", () => {
    scope = effectScope();
    scope.run(() => {
      const { supportedExportFormats } = useRendererRegistry();
      expect(supportedExportFormats.value).toEqual([
        ExportFormat.PNG,
        ExportFormat.SVG,
      ]);
    });
    scope.stop();
  });

  test("supportedExportFormats updates when renderer changes", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const { selectedRenderer, supportedExportFormats } =
        useRendererRegistry();
      expect(supportedExportFormats.value).toEqual([
        ExportFormat.PNG,
        ExportFormat.SVG,
      ]);

      selectedRenderer.value = "minimal";
      await nextTick();

      expect(supportedExportFormats.value).toEqual([ExportFormat.PNG]);
    });
    scope.stop();
  });

  test("registerRenderer adds a new renderer option", () => {
    scope = effectScope();
    scope.run(() => {
      const { registerRenderer, rendererOptions } = useRendererRegistry();
      const mockRenderer = {
        displayName: "Test Renderer",
        supportedExportFormats: [],
      };
      registerRenderer("test", mockRenderer as never);

      expect(rendererOptions.value).toHaveLength(3);
      expect(rendererOptions.value.map((o) => o.id)).toContain("test");
    });
    scope.stop();
  });

  test("switching to newly registered renderer works", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const callback = vi.fn();
      const { registerRenderer, selectedRenderer, rendererComponent } =
        useRendererRegistry("cytoscape", callback);

      const mockRenderer = {
        displayName: "Custom",
        supportedExportFormats: [],
      };
      registerRenderer("custom", mockRenderer as never);

      selectedRenderer.value = "custom";
      await nextTick();

      expect(rendererComponent.value).toBe(mockRenderer);
      expect(callback).toHaveBeenCalledTimes(1);
    });
    scope.stop();
  });
});
