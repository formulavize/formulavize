import { describe, test, expect } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { Compiler } from "src/compiler/driver";
import { ExportFormat } from "src/compiler/constants";
import {
  renderDagToBytes,
  HeadlessRenderOptions,
} from "src/cli/headlessCytoscape";

const baseOptions: HeadlessRenderOptions = {
  fileType: ExportFormat.PNG,
  scalingFactor: 1,
  isDark: false,
  includeDescriptions: true,
};

async function render(
  source: string,
  overrides: Partial<HeadlessRenderOptions> = {},
): Promise<Buffer> {
  const { DAG } = await new Compiler().compileFromSource(source);
  return renderDagToBytes(DAG, { ...baseOptions, ...overrides });
}

// Decode PNG bytes and read the top-left pixel as [r, g, b, a].
async function getCornerPixel(bytes: Buffer): Promise<number[]> {
  const image = await loadImage(bytes);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return [...ctx.getImageData(0, 0, 1, 1).data];
}

describe("headless CLI rendering", () => {
  test("renders a recipe to PNG bytes with a valid signature", async () => {
    const bytes = await render("a = load()\nprocess(a)\n");
    expect(bytes.length).toBeGreaterThan(0);
    // PNG magic number
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test("renders a recipe to JPG bytes with a valid signature", async () => {
    const bytes = await render("a = load()\nprocess(a)\n", {
      fileType: ExportFormat.JPG,
    });
    expect(bytes.length).toBeGreaterThan(0);
    // JPEG magic number
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  });

  test("renders a recipe to SVG containing node labels", async () => {
    const bytes = await render("a = alpha()\nbeta(a)\n", {
      fileType: ExportFormat.SVG,
      includeDescriptions: false,
    });
    const svg = bytes.toString("utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("alpha");
    expect(svg).toContain("beta");
  });

  test("canvas background color fills the exported PNG", async () => {
    const bytes = await render(
      '^cytoscape{ background-color: "#ff0000" }\na = load()\nprocess(a)\n',
    );
    expect(await getCornerPixel(bytes)).toEqual([0xff, 0x00, 0x00, 0xff]);
  });

  test("PNG stays transparent without a canvas binding", async () => {
    const bytes = await render("a = load()\nprocess(a)\n");
    const [, , , alpha] = await getCornerPixel(bytes);
    expect(alpha).toBe(0);
  });

  test("canvas background color fills the exported SVG", async () => {
    const bytes = await render(
      '^cytoscape{ background-color: "#ff0000" }\na = alpha()\nbeta(a)\n',
      { fileType: ExportFormat.SVG, includeDescriptions: false },
    );
    expect(bytes.toString("utf8")).toContain("#ff0000");
  });

  test("rankDir directive changes the rendered layout", async () => {
    const recipe = "a = alpha()\nbeta(a)\n";
    const svgOptions = {
      fileType: ExportFormat.SVG,
      includeDescriptions: false,
    };
    const topToBottom = await render(recipe, svgOptions);
    const leftToRight = await render(
      `^cytoscape{ rankDir: "LR" }\n${recipe}`,
      svgOptions,
    );
    expect(leftToRight.toString("utf8")).not.toEqual(
      topToBottom.toString("utf8"),
    );
  });

  test("unrecognized rankDir falls back to the default layout", async () => {
    const recipe = "a = alpha()\nbeta(a)\n";
    const svgOptions = {
      fileType: ExportFormat.SVG,
      includeDescriptions: false,
    };
    const baseline = await render(recipe, svgOptions);
    const typo = await render(
      `^cytoscape{ rankDir: "sideways" }\n${recipe}`,
      svgOptions,
    );
    expect(typo.toString("utf8")).toEqual(baseline.toString("utf8"));
  });

  test("directive for another renderer does not affect cytoscape", async () => {
    const recipe = "a = alpha()\nbeta(a)\n";
    const svgOptions = {
      fileType: ExportFormat.SVG,
      includeDescriptions: false,
    };
    const baseline = await render(recipe, svgOptions);
    const otherRenderer = await render(
      `^minimal{ rankDir: "LR" }\n${recipe}`,
      svgOptions,
    );
    expect(otherRenderer.toString("utf8")).toEqual(baseline.toString("utf8"));
  });

  test.each(["breadthfirst", "elk"])(
    "the %s layout renders headlessly and moves nodes",
    async (layoutName) => {
      const recipe = "a = alpha()\nbeta(a)\n";
      const svgOptions = {
        fileType: ExportFormat.SVG,
        includeDescriptions: false,
      };
      const baseline = await render(recipe, svgOptions);
      const rendered = await render(
        `^cytoscape{ layout: "${layoutName}" }\n${recipe}`,
        svgOptions,
      );
      const svg = rendered.toString("utf8");
      expect(svg).toContain("<svg");
      expect(svg).toContain("alpha");
      expect(svg).not.toEqual(baseline.toString("utf8"));
    },
    30_000,
  );

  test("the manual layout leaves nodes unarranged headlessly", async () => {
    const recipe = "a = alpha()\nbeta(a)\n";
    const svgOptions = {
      fileType: ExportFormat.SVG,
      includeDescriptions: false,
    };
    const baseline = await render(recipe, svgOptions);
    const manual = await render(
      `^cytoscape{ layout: "manual" }\n${recipe}`,
      svgOptions,
    );
    const manualSvg = manual.toString("utf8");
    expect(manualSvg).not.toEqual(baseline.toString("utf8"));
    expect(manualSvg).toMatch(/<svg[^>]*width="46" height="50"/);
  });

  test("a layout option changes the rendered layout", async () => {
    const recipe = "a = alpha()\nbeta(a)\n";
    const svgOptions = {
      fileType: ExportFormat.SVG,
      includeDescriptions: false,
    };
    const baseline = await render(recipe, svgOptions);
    const spaced = await render(
      `^cytoscape{ rankSep: 300 }\n${recipe}`,
      svgOptions,
    );
    expect(spaced.toString("utf8")).not.toEqual(baseline.toString("utf8"));
  });

  test("unrecognized layout falls back to the default layout", async () => {
    const recipe = "a = alpha()\nbeta(a)\n";
    const svgOptions = {
      fileType: ExportFormat.SVG,
      includeDescriptions: false,
    };
    const baseline = await render(recipe, svgOptions);
    const typo = await render(
      `^cytoscape{ layout: "elkk" }\n${recipe}`,
      svgOptions,
    );
    expect(typo.toString("utf8")).toEqual(baseline.toString("utf8"));
  });

  test("scaling factor increases the rendered image size", async () => {
    const small = await render("a = load()\nprocess(a)\n", {
      scalingFactor: 1,
    });
    const large = await render("a = load()\nprocess(a)\n", {
      scalingFactor: 3,
    });
    expect(large.length).toBeGreaterThan(small.length);
  });
});
