import {
  BreadthFirstLayoutOptions,
  LayoutOptions,
  NodeSingular,
  PresetLayoutOptions,
} from "cytoscape";
import { Dag } from "../../compiler/dag";
import {
  DEFAULT_CYTOSCAPE_LAYOUT,
  CYTOSCAPE_LAYOUT_NAMES,
  LAYOUT_PROPERTY,
  MANUAL_CYTOSCAPE_LAYOUT,
} from "../../compiler/constants";
import { getCytoscapeDirectiveProperties } from "./cyRendererDirectives";
import { buildLayoutOptions } from "./cyLayoutSchema";
import { CyLayoutName, CyLayoutProvider, getLayoutProvider } from "./layouts";

export type { CyLayoutName };

// cytoscape's LayoutOptions covers neither dagre's nor the elk extension's
// members. None of those three ship typings, so they are declared here.
// Refer to each layout's documentation for the full option set:
// https://github.com/cytoscape/cytoscape.js-dagre#api
// https://github.com/cytoscape/cytoscape.js-elk
export type DagreLayoutOptions = LayoutOptions & {
  name: "dagre";
  sort: (a: NodeSingular, b: NodeSingular) => number;
};

export type ElkLayoutOptions = LayoutOptions & {
  name: "elk";
  // Passed straight through to ELK as its layoutOptions map.
  elk: Record<string, string>;
};

export type CyLayoutOptions =
  | DagreLayoutOptions
  | (BreadthFirstLayoutOptions & { name: "breadthfirst" })
  | ElkLayoutOptions
  // Preset is what the 'manual' layout runs; see layouts/manual.ts.
  | PresetLayoutOptions;

/**
 * Layout selected by a '^cytoscape{ layout: "elk" }' directive.
 *
 * Unrecognized layout names fall back to the default layout rather than erring:
 * renderer directives are never validated at compile time, so a typo silently
 * changes nothing.
 */
export function getLayoutName(dag: Dag): CyLayoutName {
  const value = getCytoscapeDirectiveProperties(dag).get(LAYOUT_PROPERTY);
  if (!value) return DEFAULT_CYTOSCAPE_LAYOUT;
  const normalized = value.trim().toLowerCase();
  return (CYTOSCAPE_LAYOUT_NAMES as readonly string[]).includes(normalized)
    ? (normalized as CyLayoutName)
    : DEFAULT_CYTOSCAPE_LAYOUT;
}

/**
 * Get the layout provider selected by the dag's renderer directive.
 */
export function getDagLayoutProvider(dag: Dag): CyLayoutProvider {
  return getLayoutProvider(getLayoutName(dag));
}

/**
 * Whether or not the dag allows users to manually position nodes instead
 * of using a layout algorithm.
 */
export function isManualLayout(dag: Dag): boolean {
  return getLayoutName(dag) === MANUAL_CYTOSCAPE_LAYOUT;
}

/**
 * Cytoscape layout options for the layout selected by the dag's directive,
 * with that layout's own options applied on top of our defaults.
 */
export function makeLayoutOptions(dag: Dag): CyLayoutOptions {
  const layoutName = getLayoutName(dag);
  const properties = getCytoscapeDirectiveProperties(dag);
  // The schema builds a plain bag; each layout's shape is enforced by its table.
  return buildLayoutOptions(
    layoutName,
    properties,
  ) as unknown as CyLayoutOptions;
}

/**
 * Value fingerprint of a dag's layout options, used to decide whether editing a
 * directive needs a re-layout. JSON.stringify drops the function-valued options
 * (the sort hints), so this signature compares only the serializable layout
 * state and ignores comparator callbacks that do not affect the layout value.
 */
export function getLayoutSignature(dag: Dag): string {
  return JSON.stringify(makeLayoutOptions(dag));
}
