import { describe, test, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { fizLanguage } from "@formulavize/lang-fiz";
import {
  StyleColor,
  findStyleColors,
  rewriteStyleColor,
} from "src/editor/colorPicker";

function colorsIn(source: string): StyleColor[] {
  const state = EditorState.create({
    doc: source,
    extensions: [fizLanguage],
  });
  return findStyleColors(state, 0, state.doc.length);
}

function valuesIn(source: string): string[] {
  return colorsIn(source).map((found) => source.slice(found.from, found.to));
}

describe("findStyleColors", () => {
  test("finds a quoted hex value in a style tag declaration", () => {
    const source = '#warm{ background-color: "#ff0000" }\nf()\n';
    expect(colorsIn(source)).toEqual([
      {
        from: source.indexOf('"#ff0000"'),
        to: source.indexOf('"#ff0000"') + '"#ff0000"'.length,
        hex: "#ff0000",
        alpha: "",
        quote: '"',
      },
    ]);
  });

  test("finds a quoted named color", () => {
    const found = colorsIn(
      '^cytoscape{ background-color: "lightblue" }\nf()\n',
    );
    expect(found).toHaveLength(1);
    expect(found[0].hex).toBe("#add8e6");
    expect(found[0].alpha).toBe("");
  });

  test("matches a named color case insensitively", () => {
    const found = colorsIn('#t{ line-color: "LightBlue" }\nf()\n');
    expect(found).toHaveLength(1);
    expect(found[0].hex).toBe("#add8e6");
  });

  test("preserves a single quote so a rewrite can restore it", () => {
    const found = colorsIn("#t{ color: 'red' }\nf()\n");
    expect(found).toHaveLength(1);
    expect(found[0].quote).toBe("'");
    expect(found[0].hex).toBe("#ff0000");
  });

  test("expands a short hex and doubles its alpha digit", () => {
    const found = colorsIn('#t{ color: "#f0a8" }\nf()\n');
    expect(found).toHaveLength(1);
    expect(found[0].hex).toBe("#ff00aa");
    expect(found[0].alpha).toBe("88");
  });

  test("keeps the alpha digits of a long hex", () => {
    const found = colorsIn('#t{ color: "#ff00aa80" }\nf()\n');
    expect(found).toHaveLength(1);
    expect(found[0].hex).toBe("#ff00aa");
    expect(found[0].alpha).toBe("80");
  });

  test("finds every value of a multi-value declaration", () => {
    expect(valuesIn('#t{ border-color: "red", "blue" }\nf()\n')).toEqual([
      '"red"',
      '"blue"',
    ]);
  });

  test("finds colors across several declarations and blocks", () => {
    const source = [
      '^cytoscape{ background-color: "white" }',
      "#warm{",
      '  background-color: "lightcoral"',
      '  color: "black"',
      "}",
      "f()\n",
    ].join("\n");
    expect(valuesIn(source)).toEqual(['"white"', '"lightcoral"', '"black"']);
  });

  test("ignores a non-color property that happens to hold a color name", () => {
    expect(valuesIn('#t{ label: "red" }\nf()\n')).toEqual([]);
  });

  test("ignores a fill property, which names a fill style not a color", () => {
    expect(valuesIn('#t{ background-fill: "solid" }\nf()\n')).toEqual([]);
  });

  test("ignores a value that is not a color", () => {
    expect(valuesIn('#t{ background-color: "data(bg)" }\nf()\n')).toEqual([]);
  });

  test("ignores a gradient stop list, which holds several colors in one value", () => {
    expect(
      valuesIn('#t{ background-gradient-stop-colors: "red blue" }\nf()\n'),
    ).toEqual([]);
  });

  test("ignores an import path that names a color", () => {
    expect(valuesIn('red = @ "red"\nf(red)\n')).toEqual([]);
  });

  test("ignores a description string in a style block", () => {
    expect(valuesIn('#t{ "red" }\nf()\n')).toEqual([]);
  });

  test("finds a bare hex literal", () => {
    const found = colorsIn("#t{ background-color: #ff0000 }\nf()\n");
    expect(found).toHaveLength(1);
    expect(found[0].hex).toBe("#ff0000");
    expect(found[0].quote).toBe("");
  });

  test("keeps the alpha digits of a bare hex literal", () => {
    const found = colorsIn("#t{ background-color: #ff00aa80 }\nf()\n");
    expect(found).toHaveLength(1);
    expect(found[0].hex).toBe("#ff00aa");
    expect(found[0].alpha).toBe("80");
  });

  test("ignores a bare hex literal in a non-color property", () => {
    expect(valuesIn("#t{ label: #ff0000 }\nf()\n")).toEqual([]);
  });

  test("finds bare and quoted values in one declaration, in order", () => {
    expect(valuesIn('#t{ border-color: #ff0000, "blue" }\nf()\n')).toEqual([
      "#ff0000",
      '"blue"',
    ]);
  });

  test("ignores a numeric value in a color property", () => {
    expect(valuesIn("#t{ border-color: 4 }\nf()\n")).toEqual([]);
  });

  test("only reports colors inside the requested range", () => {
    const source = ['#a{ color: "red" }', '#b{ color: "blue" }', "f()\n"].join(
      "\n",
    );
    const state = EditorState.create({
      doc: source,
      extensions: [fizLanguage],
    });
    const secondLine = state.doc.line(2);
    const found = findStyleColors(state, secondLine.from, secondLine.to);
    expect(found.map((color) => source.slice(color.from, color.to))).toEqual([
      '"blue"',
    ]);
  });

  test("finds nothing in a recipe without styles", () => {
    expect(valuesIn("a = load()\nprocess(a)\n")).toEqual([]);
  });
});

describe("rewriteStyleColor", () => {
  const base: StyleColor = {
    from: 0,
    to: 0,
    hex: "#ff0000",
    alpha: "",
    quote: '"',
  };

  test("writes the picked color back in the original quote style", () => {
    expect(rewriteStyleColor({ ...base, quote: "'" }, "#00FF00")).toBe(
      "'#00ff00'",
    );
  });

  test("carries the original alpha through unchanged", () => {
    expect(rewriteStyleColor({ ...base, alpha: "80" }, "#00ff00")).toBe(
      '"#00ff0080"',
    );
  });

  test("replaces a named color with the picked hex", () => {
    expect(rewriteStyleColor(base, "#123456")).toBe('"#123456"');
  });

  test("writes a bare value back unquoted", () => {
    expect(rewriteStyleColor({ ...base, quote: "" }, "#00FF00")).toBe(
      "#00ff00",
    );
  });
});
