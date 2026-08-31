import {
  ExportFormat,
  HeadlessRenderOptions,
  RendererDescriptor,
} from "../../rendererApi";
import { Dag } from "../../compiler/dag";
import { makeDagSummaryText } from "./minimalExport";

export const MINIMAL_RENDERER_NAME: string = "minimal";

/**
 * The minimal renderer minus the component that draws it.
 *
 * It offers no `completions`, which is what a renderer with no style vocabulary
 * of its own looks like: the editor simply suggests nothing inside its blocks.
 *
 * Its renderHeadless sits here rather than in a separate node-side entry point
 * because producing the text needs no DOM at all, so nothing browser-only
 * would leak into the CLI by keeping it alongside the descriptor.
 */
export const minimalRendererMeta: RendererDescriptor = {
  name: MINIMAL_RENDERER_NAME,
  displayName: "Minimal Example Renderer",
  supportedExportFormats: [ExportFormat.TXT],

  renderHeadless: async (
    dag: Dag,
    options: HeadlessRenderOptions,
  ): Promise<Uint8Array> => {
    if (options.fileType !== ExportFormat.TXT) {
      throw new Error(`Unsupported export format: ${options.fileType}`);
    }
    return new TextEncoder().encode(makeDagSummaryText(dag));
  },
};
