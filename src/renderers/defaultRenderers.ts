import { RendererPlugin } from "../rendererApi";
import { cytoscapePlugin } from "./cyDag";
import { minimalPlugin } from "./minExample";

/**
 * Renderers the app ships with.
 *
 * This is the place a renderer is registered: import its plugin and add it here.
 * The first entry is the default, used when a recipe selects no renderer.
 */
export const defaultRendererPlugins: readonly RendererPlugin[] = [
  cytoscapePlugin,
  minimalPlugin,
];
