import { RendererDescriptor } from "../rendererApi";
import { cytoscapeHeadlessPlugin } from "./cyDag/headless";
import { minimalRendererMeta } from "./minExample/meta";

/**
 * Every renderer the CLI knows about.
 *
 * A renderer that cannot draw without a browser still belongs here, carrying no
 * renderHeadless: a recipe asking for one must be told the CLI cannot draw it,
 * rather than resolving past it to a renderer the recipe never asked for.
 *
 * These are descriptors rather than plugins because no headless caller needs
 * the Vue component, and loading one would drag the browser rendering stack
 * into the CLI.
 */
export const headlessRendererDescriptors: readonly RendererDescriptor[] = [
  cytoscapeHeadlessPlugin,
  minimalRendererMeta,
];
