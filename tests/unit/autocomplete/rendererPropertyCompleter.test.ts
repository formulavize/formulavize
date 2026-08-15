import { describe, test, expect } from "vitest";
import { createRendererPropertyCompletionSource } from "src/autocomplete/rendererPropertyCompleter";
import {
  CompletionIndex,
  ContextScenarioType,
} from "src/autocomplete/autocompletion";
import { getRendererPropertyCompletionsByElementType } from "src/autocomplete/rendererProperties";
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
      "cytoscape",
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
      "cytoscape",
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
      "cytoscape",
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
      "cytoscape",
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
      "cytoscape",
    );
    const ctx = createMockContext(30, 'func() { background-color: "re', false);
    const result = await runSource(source, ctx);
    expect(result).toBeNull();
  });

  test("handles fallback path (inside { without registered context)", async () => {
    const completionIndex = new CompletionIndex([], [], []);
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      "cytoscape",
    );
    // Inside braces, after semicolon, typing a property name
    const ctx = createMockContext(30, "func() { color: red; back", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("background-color");
  });

  test("returns empty completions with empty property list", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.StyleArgList, from: 10, to: 30 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      "unknown",
    );
    const ctx = createMockContext(15, "func() { back", false);
    const result = await runSource(source, ctx);
    expect(result).toBeNull();
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
      "cytoscape",
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
      "cytoscape",
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
      "cytoscape",
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
      "cytoscape",
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
  function makeDirectiveIndex(rendererDirectiveName: string): CompletionIndex {
    return new CompletionIndex(
      [],
      [
        {
          type: ContextScenarioType.StyleArgList,
          from: 10,
          to: 30,
          rendererDirectiveName: rendererDirectiveName,
        },
      ],
      [],
    );
  }

  test("offers only directive properties inside a matching directive", async () => {
    const source = createRendererPropertyCompletionSource(
      makeDirectiveIndex("cytoscape"),
      "cytoscape",
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
      "cytoscape",
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
      "cytoscape",
    );
    const ctx = createMockContext(15, "^cytoscape{ ba", false);
    const result = await runSource(source, ctx);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain("background-color");
    expect(labels).not.toContain("background-opacity");
  });

  test("regex fallback offers nothing for another renderer", async () => {
    const source = createRendererPropertyCompletionSource(
      new CompletionIndex([], [], []),
      "cytoscape",
    );
    const ctx = createMockContext(15, "^minimal{ ba", false);
    const result = await runSource(source, ctx);
    expect(result!.options).toEqual([]);
  });
});

describe("rendererPropertyCompletionsByElementType", () => {
  test("node completions include node properties and shared properties", () => {
    const nodeProps = getRendererPropertyCompletionsByElementType(
      "cytoscape",
      "node",
    );
    const labels = nodeProps.map((c) => c.label);
    expect(labels).toContain("background-color");
    expect(labels).toContain("shape");
    expect(labels).toContain("color"); // shared label style
    expect(labels).not.toContain("line-color");
    expect(labels).not.toContain("curve-style");
  });

  test("edge completions include edge properties and shared properties", () => {
    const edgeProps = getRendererPropertyCompletionsByElementType(
      "cytoscape",
      "edge",
    );
    const labels = edgeProps.map((c) => c.label);
    expect(labels).toContain("line-color");
    expect(labels).toContain("curve-style");
    expect(labels).toContain("color"); // shared label style
    expect(labels).not.toContain("background-color");
    expect(labels).not.toContain("shape");
  });

  test("subgraph completions include node properties", () => {
    const nsProps = getRendererPropertyCompletionsByElementType(
      "cytoscape",
      "subgraph",
    );
    const labels = nsProps.map((c) => c.label);
    expect(labels).toContain("background-color");
    expect(labels).toContain("shape");
    expect(labels).toContain("color"); // shared label style
    expect(labels).not.toContain("line-color");
    expect(labels).not.toContain("curve-style");
  });

  test("unknown renderer returns empty", () => {
    expect(
      getRendererPropertyCompletionsByElementType("unknown", "node"),
    ).toEqual([]);
  });

  test("unknown element type returns all properties", () => {
    const allProps = getRendererPropertyCompletionsByElementType(
      "cytoscape",
      "unknown",
    );
    const labels = allProps.map((c) => c.label);
    expect(labels).toContain("background-color");
    expect(labels).toContain("line-color");
  });
});
