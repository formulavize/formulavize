import type cytoscape from "cytoscape";
import { getLayoutProviderByCyName } from "./layouts";

// The cytoscape module is taken as an argument rather than imported: the CLI
// imports cytoscape only after installing its jsdom globals, so this module must
// not pull the library in as a side effect of being loaded.
type CytoscapeModule = typeof cytoscape;

const registered = new Set<string>();

/**
 * Register the cytoscape extension backing a layout, at most once per process.
 *
 * Keyed by the cytoscape layout name (what a layout options bag carries in its
 * 'name'), which is not necessarily the name in the recipe: 'manual' runs the
 * built-in 'preset' layout. A layout whose provider declares no loader is built
 * into cytoscape core and needs no registration.
 *
 * The loader lives on the provider (see layouts/), so elkjs is still imported
 * on first use and code-split out of the main bundle.
 */
export async function ensureLayoutRegistered(
  cy: CytoscapeModule,
  layoutName: string,
): Promise<void> {
  if (registered.has(layoutName)) return;
  const loadExtension = getLayoutProviderByCyName(layoutName)?.loadExtension;
  if (!loadExtension) {
    // for layouts built into cytoscape core, which need no registration
    registered.add(layoutName);
    return;
  }
  cy.use(await loadExtension());
  registered.add(layoutName);
}

/** Test seam: forget which extensions have been registered. */
export function resetRegisteredLayouts(): void {
  registered.clear();
}
