import { describe, test, expect } from "vitest";
import { ExportFormat } from "src/rendererApi";
import { Compiler } from "src/compiler/driver";
import { makeDagSummaryText } from "src/renderers/minExample/minimalExport";
import { minimalRendererMeta } from "src/renderers/minExample/meta";

const baseOptions = {
  fileType: ExportFormat.TXT,
  scalingFactor: 1,
  isDark: false,
  includeDescriptions: true,
};

async function compile(source: string) {
  return (await new Compiler().compileFromSource(source)).DAG;
}

describe("makeDagSummaryText", () => {
  test("reports the node and edge counts", async () => {
    const dag = await compile(
      "data = load()\nclean = scrub(data)\nreport(data, clean)",
    );
    expect(makeDagSummaryText(dag)).toBe(
      [
        "Basic DAG Statistics",
        "--------------------",
        "Node Count: 3",
        "Edge Count: 3",
      ].join("\n"),
    );
  });

  test("an empty recipe reports zeroes", async () => {
    expect(makeDagSummaryText(await compile(""))).toContain("Node Count: 0");
  });

  test("has no leading or trailing whitespace", async () => {
    const text = makeDagSummaryText(await compile("f()"));
    expect(text).toBe(text.trim());
  });
});

describe("minimal renders headlessly", () => {
  test("writes the same text the component would download", async () => {
    const dag = await compile("data = load()\nprocess(data)");
    const bytes = await minimalRendererMeta.renderHeadless!(dag, baseOptions);
    expect(new TextDecoder().decode(bytes)).toBe(makeDagSummaryText(dag));
  });

  test("txt is the format an unflagged CLI run picks", () => {
    // The CLI falls back to the first supported format, so this ordering is
    // what makes `fviz recipe.fiz` write text for a minimal recipe.
    expect(minimalRendererMeta.supportedExportFormats[0]).toBe(
      ExportFormat.TXT,
    );
  });

  test("refuses a format it does not support", async () => {
    const dag = await compile("f()");
    await expect(
      minimalRendererMeta.renderHeadless!(dag, {
        ...baseOptions,
        fileType: ExportFormat.PNG,
      }),
    ).rejects.toThrow("Unsupported export format: png");
  });
});
