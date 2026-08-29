import { StyleProperties } from "../../compiler/dag";
import { getLayoutProvider } from "./layouts";
import { CyLayoutName, LayoutOptionBag, OptionGroup } from "./layouts/types";

export type { CyLayoutName };

function setOption(
  bag: LayoutOptionBag,
  group: OptionGroup | undefined,
  target: string,
  value: unknown,
): void {
  if (!group) {
    bag[target] = value;
    return;
  }
  const groupBag = (bag[group] ?? {}) as LayoutOptionBag;
  // ELK reads its layoutOptions as strings and parses them itself, so numbers
  // and booleans are stringified rather than passed through as-is.
  groupBag[target] = group === "elk" ? String(value) : value;
  bag[group] = groupBag;
}

/**
 * Build the cytoscape layout options for one layout from resolved directive
 * properties. Keys the layout does not know are ignored, and values that fail
 * to parse are dropped so the layout's own defaults apply.
 */
export function buildLayoutOptions(
  layoutName: CyLayoutName,
  properties: StyleProperties,
): LayoutOptionBag {
  const provider = getLayoutProvider(layoutName);
  const options: LayoutOptionBag = {
    name: provider.cyLayoutTargetName ?? layoutName,
  };
  for (const [key, value] of Object.entries(provider.defaultOptions)) {
    // Clone group bags so a directive can never mutate the shared provider.
    options[key] =
      value && typeof value === "object" ? { ...(value as object) } : value;
  }

  const specsByKey = new Map(
    provider.options.map((spec) => [spec.directiveKey, spec]),
  );
  for (const [key, rawValue] of properties) {
    const spec = specsByKey.get(key);
    if (spec) {
      const parsed = spec.parse(rawValue);
      if (parsed !== undefined) {
        const group = spec.topLevel ? undefined : provider.optionGroup;
        setOption(
          options,
          group,
          spec.optionTargetKey ?? spec.directiveKey,
          parsed,
        );
      }
      continue;
    }
    // A layout may claim keys its option table does not list, forwarding the
    // raw value; see the 'elk-*' escape hatch in layouts/elk.ts. Pass-through
    // keys are always engine options, so they go straight into the group.
    const extra = provider.extraOption?.(key);
    if (extra) setOption(options, provider.optionGroup, extra, rawValue);
  }

  return options;
}

/** Returns directive keys a given layout understands, for autocomplete. */
export function getLayoutOptionKeys(layoutName: CyLayoutName): string[] {
  return getLayoutProvider(layoutName).options.map((spec) => spec.directiveKey);
}
