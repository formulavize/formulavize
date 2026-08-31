import {
  CYTOSCAPE_LAYOUT_NAMES,
  CyLayoutName,
  CyLayoutProvider,
  DEFAULT_CYTOSCAPE_LAYOUT,
} from "./types";
import { dagreLayout } from "./dagre";
import { breadthfirstLayout } from "./breadthfirst";
import { elkLayout } from "./elk";
import { manualLayout } from "./manual";

// Option names are taken as-is from each layout's own documentation rather
// than normalized into a shared vocabulary, so the name in the recipe
// reads the same as the upstream documentation.
// Only one layout is active at a time, so keys that mean
// different things in different layouts (e.g. 'direction') cannot collide.

/**
 * Selectable layouts keyed by the name a recipe writes in a renderer directive.
 * e.g. '^cytoscape{ layout: "<name>" }'
 *
 * Typing this as a total Record over CyLayoutName keeps the registry
 * and CYTOSCAPE_LAYOUT_NAMES in agreement: adding a name without a provider
 * fails to compile.
 */
export const LAYOUT_PROVIDERS: Record<CyLayoutName, CyLayoutProvider> = {
  dagre: dagreLayout,
  breadthfirst: breadthfirstLayout,
  elk: elkLayout,
  manual: manualLayout,
};

export function getLayoutProvider(name: CyLayoutName): CyLayoutProvider {
  return LAYOUT_PROVIDERS[name];
}

/**
 * Fold a raw layout name written in a directive onto a selectable layout.
 *
 * An absent or unrecognized name resolves to the default rather than erring:
 * renderer directives are never validated at compile time, so a typo silently
 * changes nothing. Shared by the renderer and by autocomplete so both agree on
 * which layout a given directive block really selects.
 */
export function resolveLayoutName(value: string | undefined): CyLayoutName {
  if (!value) return DEFAULT_CYTOSCAPE_LAYOUT;
  const normalized = value.trim().toLowerCase();
  return (CYTOSCAPE_LAYOUT_NAMES as readonly string[]).includes(normalized)
    ? (normalized as CyLayoutName)
    : DEFAULT_CYTOSCAPE_LAYOUT;
}

// A layout options bag carries the cytoscape name, which is not always the name
// a recipe writes (e.g. 'manual' runs the built-in 'preset' layout),
// so extension registration looks providers up by their cytoscape name.
export function getLayoutProviderByCyName(
  cyName: string,
): CyLayoutProvider | undefined {
  const providersByCyName = new Map<string, CyLayoutProvider>(
    Object.values(LAYOUT_PROVIDERS).map((provider) => [
      provider.cyLayoutTargetName ?? provider.layoutName,
      provider,
    ]),
  );
  return providersByCyName.get(cyName);
}

export type { CyLayoutName, CyLayoutProvider };
export {
  CYTOSCAPE_LAYOUT_NAMES,
  DEFAULT_CYTOSCAPE_LAYOUT,
  MANUAL_CYTOSCAPE_LAYOUT,
} from "./types";
