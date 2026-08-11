import { describe, test, expect } from "vitest";
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
