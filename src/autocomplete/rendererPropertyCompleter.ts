import {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

import { CompletionIndex, ContextScenarioType } from "./autocompletion";
import { PropertyCompletion, RendererDescriptor } from "../rendererApi";
import { GLOBAL_STYLE_KEYWORD_MAP } from "../compiler/constants";

const NO_PROPERTIES: Completion[] = [];

function toCompletions(properties: PropertyCompletion[]): Completion[] {
  return properties.map(({ name, detail, info }) => ({
    label: name,
    type: "property",
    detail,
    info,
  }));
}

// Harvest the 'key: value' pairs already written inside a directive block, so a
// renderer can narrow what it offers even before the debounced compile has
// produced a context scenario for the block. Values are read as written; what
// any given key means is the renderer's business.
function scrapeDeclaredProps(text: string): Map<string, string> {
  const declared = new Map<string, string>();
  const pairPattern = /([\w-]+)\s*:\s*"?([^;"{}]*)"?/g;
  for (const [, key, value] of text.matchAll(pairPattern)) {
    declared.set(key, value.trim());
  }
  return declared;
}

/**
 * Offers the active renderer's property names inside style and directive blocks.
 *
 * Holds no vocabulary of its own: every property offered comes from the
 * plugin's `completions`, so this source works unchanged for any renderer and
 * simply goes quiet for one that declares no vocabulary.
 */
export function createRendererPropertyCompletionSource(
  completionIndex: CompletionIndex,
  plugin: RendererDescriptor,
): CompletionSource {
  const rendererCompletions = plugin.completions;
  const allProperties = rendererCompletions
    ? toCompletions(rendererCompletions.styleProperties())
    : NO_PROPERTIES;

  // The offer for a given element type or directive block is stable for the
  // life of this source, so it is built once and reused across keystrokes.
  const byElementType = new Map<string, Completion[]>();
  function styleProperties(elementType: string): Completion[] {
    if (!rendererCompletions) return NO_PROPERTIES;
    const cached = byElementType.get(elementType);
    if (cached) return cached;
    const built = toCompletions(
      rendererCompletions.styleProperties(elementType),
    );
    byElementType.set(elementType, built);
    return built;
  }

  const byDeclaredProps = new Map<string, Completion[]>();
  function directiveProperties(
    declared: ReadonlyMap<string, string>,
  ): Completion[] {
    if (!rendererCompletions) return NO_PROPERTIES;
    const cacheKey = JSON.stringify(Array.from(declared).sort());
    const cached = byDeclaredProps.get(cacheKey);
    if (cached) return cached;
    const built = toCompletions(
      rendererCompletions.directiveProperties(declared),
    );
    byDeclaredProps.set(cacheKey, built);
    return built;
  }

  return (context: CompletionContext): CompletionResult | null => {
    if (allProperties.length === 0) return null;

    const contextScenario = completionIndex.getContextScenarioAt(context.pos);
    const isStyleContext =
      contextScenario?.type === ContextScenarioType.StyleArgList;

    // Reject if cursor follows '#' (style tag position — handled by existing completers)
    const hashMatch = isStyleContext
      ? context.matchBefore(/#[\w-]*/)
      : context.matchBefore(/\{[^{}]*#[\w-]*/);
    if (hashMatch) return null;

    // Reject if cursor is in property value position (after ':')
    const colonMatch = context.matchBefore(/:\s*[^\n;{}]*/);
    if (colonMatch) return null;

    // Match CSS-identifier-like input (supports hyphens)
    let match;
    if (isStyleContext) {
      match = context.matchBefore(/[\w-]*/);
    } else {
      // Fallback: inside braces but context not yet registered (debounce lag)
      match = context.matchBefore(/[*^]?\w*\{(?:[^{}]*[;{])?\s*[\w-]*/);
    }

    if (!match || (match.from === match.to && !context.explicit)) return null;

    // Determine which properties to offer
    let activeProperties = allProperties;
    if (contextScenario?.rendererDirectiveName !== undefined) {
      // A block addressed to another renderer has nothing we can suggest.
      activeProperties =
        contextScenario.rendererDirectiveName === plugin.name
          ? directiveProperties(
              contextScenario.rendererDirectiveProps ?? new Map(),
            )
          : NO_PROPERTIES;
    } else if (contextScenario?.globalStyleKeyword) {
      // Context scenario registered — use its element keyword
      activeProperties = styleProperties(contextScenario.globalStyleKeyword);
    } else if (!isStyleContext) {
      // Fallback: detect *keyword{ or ^rendererName{ pattern from matched text
      const keywordMatch = /^\*(\w+)\{/.exec(match.text);
      const directiveMatch = /^\^(\w+)\{/.exec(match.text);
      if (keywordMatch) {
        const canonicalKeyword = GLOBAL_STYLE_KEYWORD_MAP.get(keywordMatch[1]);
        if (canonicalKeyword) {
          activeProperties = styleProperties(canonicalKeyword);
        }
      } else if (directiveMatch) {
        // What is already declared in the block narrows what we can offer.
        activeProperties =
          directiveMatch[1] === plugin.name
            ? directiveProperties(scrapeDeclaredProps(match.text))
            : NO_PROPERTIES;
      }
    }

    // Extract the property name prefix from the match
    let word: string;
    let from: number;
    if (isStyleContext) {
      word = match.text;
      from = match.from;
    } else {
      // Extract trailing word from fallback match (after { or ;)
      const wordMatch = /(?:[{;])\s*([\w-]*)$/.exec(match.text);
      if (!wordMatch) return null;
      word = wordMatch[1];
      from = match.to - word.length;
    }

    const filtered = activeProperties.filter((c) => c.label.startsWith(word));

    return {
      from,
      options: filtered,
    };
  };
}
