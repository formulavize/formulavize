// @vitest-environment jsdom
import { describe, test, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fizLanguage } from "@formulavize/lang-fiz";
import { colorPicker } from "src/editor/colorPicker";

let view: EditorView | null = null;

function mount(source: string): EditorView {
  view = new EditorView({
    state: EditorState.create({
      doc: source,
      extensions: [fizLanguage, colorPicker],
    }),
    parent: document.body,
  });
  return view;
}

function swatches(mounted: EditorView): HTMLInputElement[] {
  return Array.from(
    mounted.contentDOM.querySelectorAll<HTMLInputElement>(
      'input[type="color"]',
    ),
  );
}

function pick(swatch: HTMLInputElement, hex: string): void {
  swatch.value = hex;
  swatch.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = "";
});

describe("colorPicker swatches", () => {
  test("draws a swatch for a bare hex literal", () => {
    const mounted = mount("#warm{ background-color: #ff0000 }\nf()\n");
    const found = swatches(mounted);
    expect(found).toHaveLength(1);
    expect(found[0].value).toBe("#ff0000");
  });

  test("draws a swatch for a quoted named color", () => {
    const mounted = mount('#cool{ background-color: "lightblue" }\nf()\n');
    const found = swatches(mounted);
    expect(found).toHaveLength(1);
    expect(found[0].value).toBe("#add8e6");
  });

  test("draws one swatch per color when both forms appear", () => {
    const mounted = mount(
      [
        '^cytoscape{ background-color: "white" }',
        "#warm{ background-color: #ff0000 }",
        "f()\n",
      ].join("\n"),
    );
    expect(swatches(mounted).map((s) => s.value)).toEqual([
      "#ffffff",
      "#ff0000",
    ]);
  });

  test("draws no swatch for a recipe without colors", () => {
    expect(swatches(mount("a = load()\nprocess(a)\n"))).toHaveLength(0);
  });

  test("picking a color rewrites a quoted value and keeps the quoting", () => {
    const mounted = mount("#t{ background-color: 'lightblue' }\nf()\n");
    pick(swatches(mounted)[0], "#00ff00");
    expect(mounted.state.doc.toString()).toBe(
      "#t{ background-color: '#00ff00' }\nf()\n",
    );
  });

  test("picking a color keeps the alpha a quoted value carried", () => {
    const mounted = mount('#t{ background-color: "#ff000080" }\nf()\n');
    pick(swatches(mounted)[0], "#00ff00");
    expect(mounted.state.doc.toString()).toBe(
      '#t{ background-color: "#00ff0080" }\nf()\n',
    );
  });

  test("picking a color rewrites a bare hex literal in place", () => {
    const mounted = mount("#t{ background-color: #ff0000 }\nf()\n");
    pick(swatches(mounted)[0], "#00ff00");
    expect(mounted.state.doc.toString()).toBe(
      "#t{ background-color: #00ff00 }\nf()\n",
    );
  });

  test("picking a color rewrites only the value that was picked", () => {
    const mounted = mount('#t{ border-color: "red", "blue" }\nf()\n');
    pick(swatches(mounted)[1], "#00ff00");
    expect(mounted.state.doc.toString()).toBe(
      '#t{ border-color: "red", "#00ff00" }\nf()\n',
    );
  });

  test("a swatch follows an edited value", () => {
    const mounted = mount('#t{ background-color: "red" }\nf()\n');
    const valueStart = mounted.state.doc.toString().indexOf('"red"');
    mounted.dispatch({
      changes: {
        from: valueStart,
        to: valueStart + '"red"'.length,
        insert: '"lime"',
      },
    });
    expect(swatches(mounted).map((s) => s.value)).toEqual(["#00ff00"]);
  });
});
