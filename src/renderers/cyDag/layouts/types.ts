import type cytoscape from "cytoscape";
import { CYTOSCAPE_LAYOUT_NAMES } from "../../../compiler/constants";

export type CyLayoutName = (typeof CYTOSCAPE_LAYOUT_NAMES)[number];

// A directive value is always a string (StyleProperties is Map<string, string>),
// so every option needs a parser. Returning undefined for anything unrecognized
// implements the silent-fallback behavior: the key is omitted entirely
// allowing the layout to apply its own default. Renderer directives are never
// validated at compile time, so a typo silently changes nothing.
export type OptionParser = (raw: string) => unknown;

// Nested option bags. cytoscape-elk takes its engine settings in a dedicated
// sub-object rather than at the top level.
export type OptionGroup = "elk";

export interface LayoutOptionSpec {
  // The property name as written inside a '^cytoscape{ directiveKey: "value" }' directive.
  directiveKey: string;
  // The key in the emitted cytoscape layout options object.
  // Omitted means it uses directiveKey as-is.
  optionTargetKey?: string;
  // A cytoscape-core option rather than one of the layout engine's own, so it
  // stays at the top level even when the provider groups its engine options.
  // Only SHARED_OPTIONS set this.
  topLevel?: boolean;
  parse: OptionParser;
}

export type LayoutOptionBag = Record<string, unknown>;

/**
 * Everything the renderer needs to know about a selectable layout.
 *
 * A provider is the single place a layout is described: the allowable options,
 * the cytoscape extension backing it (if any), and the handful of
 * renderer behaviors that depend on which layout is running. Adding a layout
 * means adding one of these in the registry.
 */
export interface CyLayoutProvider {
  // The name written in '^cytoscape{ layout: "<name>" }'.
  layoutName: CyLayoutName;
  // The Cytoscape layout this app-level name maps to.
  // For example, we use 'manual' as our own name for Cytoscape’s built-in 'preset' layout.
  // If cyLayoutTargetName is omitted, the app name and the Cytoscape name are the same.
  cyLayoutTargetName?: string;
  // Loads the cytoscape extension backing this layout. Omitted for layouts
  // built into cytoscape core, which need no registration.
  loadExtension?: () => Promise<cytoscape.Ext>;
  // Applied before directive options so a recipe can always override them.
  // May hold function-valued options, which directives can never express.
  defaultOptions: LayoutOptionBag;
  // The sub-object this layout's engine settings go in. Omitted optionGroup
  // means the layout takes a flat options bag. Grouping is a property of the
  // layout rather than of any one option, so it is declared once here; the only
  // exceptions are the SHARED_OPTIONS, which are marked `topLevel`.
  optionGroup?: OptionGroup;
  options: LayoutOptionSpec[];
  // The option id to use for a directive key that no spec in `options` claims.
  // Such keys are always engine options, so they land in `optionGroup`.
  // Layouts without an escape hatch omit it and unknown keys are ignored.
  extraOption?: (key: string) => string | undefined;

  // Renderer behaviors that depend on the running layout. All default to false
  // or undefined, which is the behavior of every layout that places nodes
  // itself; only 'manual' sets them.

  // Nodes stay draggable even when a layout option or parent renderer requests
  // fixed positions, otherwise the fixed-position override would make it
  // impossible to manually arrange them in the manual layout.
  nodesAlwaysGrabbable?: boolean;
  // Node positions are not persisted in the underlying data; they exist only
  // as runtime state in the graph, so a rebuild must carry positions across by
  // element id rather than recompute them.
  preservesPositions?: boolean;
}
