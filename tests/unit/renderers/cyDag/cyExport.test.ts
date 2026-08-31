import { describe, test, expect, vi } from "vitest";
import { Core } from "cytoscape";
import { exportCyToBlob } from "src/renderers/cyDag/cyExport";
import { ExportFormat } from "src/rendererApi";

function makeStubCy() {
  const png = vi.fn(() => new Blob(["png"]));
  const jpg = vi.fn(() => new Blob(["jpg"]));
  const svg = vi.fn(() => "<svg></svg>");
  return { cy: { png, jpg, svg } as unknown as Core, png, jpg, svg };
}

describe("background color is forwarded to the exporters", () => {
  test("png receives bg", () => {
    const { cy, png } = makeStubCy();
    exportCyToBlob(cy, {
      fileName: "test",
      fileType: ExportFormat.PNG,
      scalingFactor: 1,
      backgroundColor: "#fff",
    });
    expect(png).toHaveBeenCalledWith(expect.objectContaining({ bg: "#fff" }));
  });
  test("jpg receives bg", () => {
    const { cy, jpg } = makeStubCy();
    exportCyToBlob(cy, {
      fileName: "test",
      fileType: ExportFormat.JPG,
      scalingFactor: 1,
      backgroundColor: "#fff",
    });
    expect(jpg).toHaveBeenCalledWith(expect.objectContaining({ bg: "#fff" }));
  });
  test("svg receives bg", () => {
    const { cy, svg } = makeStubCy();
    exportCyToBlob(cy, {
      fileName: "test",
      fileType: ExportFormat.SVG,
      scalingFactor: 1,
      backgroundColor: "#fff",
    });
    expect(svg).toHaveBeenCalledWith(expect.objectContaining({ bg: "#fff" }));
  });
  test("bg is undefined when no background color is given", () => {
    const { cy, png } = makeStubCy();
    exportCyToBlob(cy, {
      fileName: "test",
      fileType: ExportFormat.PNG,
      scalingFactor: 1,
    });
    expect(png).toHaveBeenCalledWith(
      expect.objectContaining({ bg: undefined }),
    );
  });
  test("unsupported format returns null", () => {
    const { cy } = makeStubCy();
    expect(
      exportCyToBlob(cy, {
        fileName: "test",
        fileType: ExportFormat.TXT,
        scalingFactor: 1,
      }),
    ).toBeNull();
  });
});
