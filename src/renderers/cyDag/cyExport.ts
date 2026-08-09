import { match } from "ts-pattern";
import { Core } from "cytoscape";
import { ExportFormat } from "../../compiler/constants";
import { FileExportOptions } from "../../compiler/rendererTypes";

/**
 * Export a Cytoscape instance to an image Blob using the format and scaling
 * factor from the given options. Returns null for unsupported formats.
 *
 * Shared by the Vue renderer component and the headless CLI so both produce
 * identical output. Callers are responsible for adding/removing description
 * ghost nodes around this call and for persisting the resulting Blob.
 */
export function exportCyToBlob(
  cy: Core,
  exportOptions: FileExportOptions,
): Blob | null {
  // Issue: the svg exporter rasterizes images in the graph.
  // The workaround for exporting large images is to export a scaled up
  // raster image and then downscale it in an image editor.
  // Ideally, this issue should be addressed in the underlying library.
  // Speculatively, we might be able to swap the image tags in the svg.
  // Svg export is still a useful starting point for those who want to
  // manually edit layouts in an svg editor.
  const scaleFactor = exportOptions.scalingFactor;
  return match(exportOptions.fileType)
    .with(ExportFormat.PNG, () => {
      return cy.png({
        full: true,
        scale: scaleFactor,
        output: "blob",
      });
    })
    .with(ExportFormat.JPG, () => {
      return cy.jpg({
        full: true,
        scale: scaleFactor,
        output: "blob",
      });
    })
    .with(ExportFormat.SVG, () => {
      // @ts-expect-error: missing types
      const svgData = cy.svg({ full: true, scale: scaleFactor });
      return new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
    })
    .otherwise((format) => {
      console.error(`Unsupported export format: ${format}`);
      return null;
    });
}
