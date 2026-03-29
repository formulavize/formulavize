import { describe, test, expect } from "vitest";
import { createRendererPropertyCompletionSource } from "src/autocomplete/rendererPropertyCompleter";
import {
  CompletionIndex,
  ContextScenarioType,
} from "src/autocomplete/autocompletion";
import { getRendererPropertyCompletions } from "src/autocomplete/rendererProperties";
import { createMockContext, runSource } from "./autocompleteTestHelpers";

const cytoscapeProperties = getRendererPropertyCompletions("cytoscape");

describe("rendererPropertyCompleter", () => {
  test("returns property completions in StyleArgList context", async () => {
    const completionIndex = new CompletionIndex(
      [],
      [{ type: ContextScenarioType.StyleArgList, from: 10, to: 30 }],
      [],
    );
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeProperties,
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
      cytoscapeProperties,
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
      cytoscapeProperties,
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
      cytoscapeProperties,
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
      cytoscapeProperties,
    );
    const ctx = createMockContext(30, 'func() { background-color: "re', false);
    const result = await runSource(source, ctx);
    expect(result).toBeNull();
  });

  test("handles fallback path (inside { without registered context)", async () => {
    const completionIndex = new CompletionIndex([], [], []);
    const source = createRendererPropertyCompletionSource(
      completionIndex,
      cytoscapeProperties,
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
    const source = createRendererPropertyCompletionSource(completionIndex, []);
    const ctx = createMockContext(15, "func() { back", false);
    const result = await runSource(source, ctx);
    expect(result).toBeNull();
  });
});
