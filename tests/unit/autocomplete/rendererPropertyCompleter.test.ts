import { describe, test, expect } from "vitest";
import { createRendererPropertyCompletionSource } from "src/autocomplete/rendererPropertyCompleter";
import {
  CompletionIndex,
  ContextScenarioType,
} from "src/autocomplete/autocompletion";
import { PropertyCompletion, RendererDescriptor } from "src/rendererApi";
// The descriptor, not the plugin: the completer needs the renderer's
// vocabulary, never the component that draws it.
import { cytoscapeRendererMeta } from "src/renderers/cyDag/meta";
import { createMockContext, runSource } from "./autocompleteTestHelpers";

describe("rendererPropertyCompleter", () => {
  test("returns property completions in StyleArgList context", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.StyleArgList, from: 10, to: 30 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    // Cursor at position 15, typing "back" inside style block
    const ctx = createMockContext(15, "func() { back", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("background-color");
    expect(labels).toContain("background-opacity");
  });

  test("filters by prefix", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.StyleArgList, from: 10, to: 30 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "func() { line-", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("line-color");
    expect(labels).toContain("line-style");
  });

  test("returns null outside StyleArgList context", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.ValueName, from: 10, to: 30 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    // No braces in text — neither style context nor fallback should match
    const ctx = createMockContext(15, "func(back", false);
    const result = await runSource(source, ctx);
    expect(result).toBeNull();
  });

  test("returns null after # (style tag position)", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.StyleArgList, from: 10, to: 30 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "func() { #tag", false);
    const result = await runSource(source, ctx);
    expect(result).toBeNull();
  });

  test("returns null after : (property value position)", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.StyleArgList, from: 10, to: 50 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(30, 'func() { background-color: "re', false);
    const result = await runSource(source, ctx);
    expect(result).toBeNull();
  });

  test("handles fallback path (inside { without registered context)", async () => {
    const completionIndex = new CompletionIndex([], [], []);
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    // Inside braces, after semicolon, typing a property name
    const ctx = createMockContext(30, "func() { color: red; back", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("background-color");
  });

  test("returns only node properties in global style binding for node", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [
        {
          type: ContextScenarioType.StyleArgList,
          from: 10,
          to: 30,
          globalStyleKeyword: "node",
        },
      ],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "*node { back", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("background-color");
    expect(labels).not.toContain("line-color");
    expect(labels).not.toContain("curve-style");
  });

  test("fallback: returns only node properties for *node{ without registered context", async () => {
    const completionIndex = new CompletionIndex([], [], []);
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "*node{back", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("background-color");
    expect(labels).not.toContain("line-color");
    expect(labels).not.toContain("curve-style");
  });

  test("fallback: returns only edge properties for *edge{ without registered context", async () => {
    const completionIndex = new CompletionIndex([], [], []);
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "*edge{line-", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("line-color");
    expect(labels).toContain("line-style");
    expect(labels).not.toContain("background-color");
    expect(labels).not.toContain("shape");
  });

  test("returns only edge properties in global style binding for edge", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [
        {
          type: ContextScenarioType.StyleArgList,
          from: 10,
          to: 30,
          globalStyleKeyword: "edge",
        },
      ],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "*edge { line-", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("line-color");
    expect(labels).toContain("line-style");
    expect(labels).not.toContain("background-color");
    expect(labels).not.toContain("shape");
  });
});

describe("renderer directive completions", () => {
  function makeDirectiveIndex(
    rendererDirectiveName: string,
    declared: ReadonlyMap<string, string> = new Map(),
  ): CompletionIndex {
    return new CompletionIndex(
      [],
      [
        {
          type: ContextScenarioType.StyleArgList,
          from: 10,
          to: 30,
          rendererDirectiveName: rendererDirectiveName,
          rendererDirectiveProps: declared,
        },
      ],
      [],
    );
  }

  test("offers only directive properties inside a matching directive", async () => {
    const source = createRendererPropertyCompletionSource(
      makeDirectiveIndex("cytoscape"),
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "^cytoscape{ ra", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("rankDir");
    // Stylesheet properties are not directives
    expect(labels).not.toContain("border-width");
    expect(labels).not.toContain("line-color");
  });

  test("offers nothing inside a directive for another renderer", async () => {
    const source = createRendererPropertyCompletionSource(
      makeDirectiveIndex("minimal"),
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "^minimal{ ra", false);
    const result = await runSource(source, ctx);
    expect(result!.options).toEqual([]);
  });

  test("regex fallback handles a directive before the index registers", async () => {
    // The CompletionIndex lags the debounce, so the completer must recognize
    // '^rendererName{' from the raw text alone.
    const source = createRendererPropertyCompletionSource(
      new CompletionIndex([], [], []),
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "^cytoscape{ ba", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("background-color");
    expect(labels).not.toContain("background-opacity");
  });

  test("a declared layout narrows the indexed directive properties", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [
        {
          type: ContextScenarioType.StyleArgList,
          from: 10,
          to: 60,
          rendererDirectiveName: "cytoscape",
          rendererDirectiveProps: new Map([["layout", "elk"]]),
        },
      ],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeRendererMeta,
    );
    const text = '^cytoscape{ layout:"elk"; elk-';
    const result = await runSource(
      source,
      createMockContext(text.length, text, false),
    );
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("elk-direction");
  });

  test("regex fallback reads the layout from the raw text", async () => {
    const source = createRendererPropertyCompletionSource(
      new CompletionIndex([], [], []),
      cytoscapeRendererMeta,
    );
    const text = '^cytoscape{ layout:"elk"; elk-';
    const result = await runSource(
      source,
      createMockContext(text.length, text, false),
    );
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("elk-direction");
    expect(labels).not.toContain("rankDir");
  });

  test("regex fallback offers nothing for another renderer", async () => {
    const source = createRendererPropertyCompletionSource(
      new CompletionIndex([], [], []),
      cytoscapeRendererMeta,
    );
    const ctx = createMockContext(15, "^minimal{ ba", false);
    const result = await runSource(source, ctx);
    expect(result!.options).toEqual([]);
  });
});

describe("the completer holds no renderer vocabulary of its own", () => {
  const fakeProperties: PropertyCompletion[] = [{ name: "wobble" }];

  const fakePlugin = {
    name: "fake",
    displayName: "Fake",
    supportedExportFormats: [],
    completions: {
      styleProperties: (elementType?: string) =>
        elementType === "edge" ? [{ name: "wiggle" }] : fakeProperties,
      directiveProperties: (declared: ReadonlyMap<string, string>) =>
        declared.has("layout") ? [{ name: "wombat" }] : [{ name: "wallaby" }],
    },
  } as unknown as RendererDescriptor;

  test("offers whatever the plugin declares", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.StyleArgList, from: 10, to: 30 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      fakePlugin,
    );
    const result = await runSource(
      source,
      createMockContext(15, "func() { wob", false),
    );
    expect(result!.options.map((o) => o.label)).toEqual(["wobble"]);
  });

  test("narrows by element type through the plugin", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [
        {
          type: ContextScenarioType.StyleArgList,
          from: 10,
          to: 30,
          globalStyleKeyword: "edge",
        },
      ],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      fakePlugin,
    );
    const result = await runSource(
      source,
      createMockContext(15, "*edge{ wig", false),
    );
    expect(result!.options.map((o) => o.label)).toEqual(["wiggle"]);
  });

  test("hands the plugin what a directive block already declares", async () => {
    // The completer scrapes 'key: value' pairs generically; only the plugin
    // decides what any of them mean.
    const source = createRendererPropertyCompletionSource(
      new CompletionIndex([], [], []),
      fakePlugin,
    );
    const withLayout = '^fake{ layout:"anything"; wom';
    const withoutLayout = "^fake{ wal";

    const narrowed = await runSource(
      source,
      createMockContext(withLayout.length, withLayout, false),
    );
    expect(narrowed!.options.map((o) => o.label)).toEqual(["wombat"]);

    const unnarrowed = await runSource(
      source,
      createMockContext(withoutLayout.length, withoutLayout, false),
    );
    expect(unnarrowed!.options.map((o) => o.label)).toEqual(["wallaby"]);
  });

  test("a plugin declaring no vocabulary offers nothing at all", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.StyleArgList, from: 10, to: 30 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(completionIndex, {
      name: "vocabulary-free",
      displayName: "Vocabulary Free",
      supportedExportFormats: [],
    });
    const result = await runSource(
      source,
      createMockContext(15, "func() { back", false),
    );
    expect(result).toBeNull();
  });
});
