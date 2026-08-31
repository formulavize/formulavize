// @vitest-environment jsdom
//
// The rest of the suite runs in the node environment, but the shipped plugins
// reach the renderer components, and both cytoscape-svg and file-saver touch
// the DOM the moment they are loaded. This is the one test that loads the real
// plugin list rather than stand-ins, so it is the one test that needs a DOM.
import { describe, test, expect } from "vitest";
import { Compiler } from "src/compiler/driver";
import { ExportFormat, RendererRegistry } from "src/rendererApi";
import { defaultRendererPlugins as plugins } from "src/renderers/defaultRenderers";

const registry = new RendererRegistry(plugins);

async function resolveFor(source: string) {
  const { DAG } = await new Compiler().compileFromSource(source);
  return registry.resolveFor(DAG);
}

describe("the renderers the app ships with", () => {
  test("every plugin satisfies the contract", () => {
    expect(plugins.length).toBeGreaterThan(0);
    for (const plugin of plugins) {
      expect(plugin.name).toBeTruthy();
      expect(plugin.displayName).toBeTruthy();
      expect(plugin.component).toBeTruthy();
      expect(plugin.supportedExportFormats.length).toBeGreaterThan(0);
    }
  });

  test("names are unique, so none shadows another in the registry", () => {
    const names = plugins.map((plugin) => plugin.name);
    expect(new Set(names).size).toBe(names.length);
    expect(registry.names()).toEqual(names);
  });

  test("cytoscape is the default and brings its own vocabulary", async () => {
    const active = await resolveFor("f()");
    expect(active?.name).toBe("cytoscape");
    expect(active?.supportedExportFormats).toEqual([
      ExportFormat.PNG,
      ExportFormat.JPG,
      ExportFormat.SVG,
    ]);
    expect(active?.completions?.styleProperties().map((p) => p.name)).toContain(
      "background-color",
    );
  });

  test("a directive selects another shipped renderer", async () => {
    const active = await resolveFor("^minimal{ }\nf()");
    expect(active?.name).toBe("minimal");
    expect(active?.supportedExportFormats).toEqual([ExportFormat.TXT]);
    // A renderer may ship no vocabulary at all.
    expect(active?.completions).toBeUndefined();
  });

  test("an unregistered name is ignored", async () => {
    expect((await resolveFor("^bogus{ }\nf()"))?.name).toBe("cytoscape");
  });

  test("the last declared registered renderer wins", async () => {
    const active = await resolveFor("^minimal{ }\n^cytoscape{ }\nf()");
    expect(active?.name).toBe("cytoscape");
  });
});
