import {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

import { CompletionIndex, ContextScenarioType } from "./autocompletion";
import {
  getRendererPropertyCompletions,
  getRendererPropertyCompletionsByElementType,
} from "./rendererProperties";
import { GLOBAL_STYLE_KEYWORD_MAP } from "../compiler/constants";

export function createRendererPropertyCompletionSource(
  completionIndex: CompletionIndex,
  rendererId: string,
): CompletionSource {
  const rendererProperties = getRendererPropertyCompletions(rendererId);

  return (context: CompletionContext): CompletionResult | null => {
    if (rendererProperties.length === 0) return null;

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
      match = context.matchBefore(/\*?\w*\{(?:[^{}]*[;{])?\s*[\w-]*/);
    }

    if (!match || (match.from === match.to && !context.explicit)) return null;

    // Determine which properties to offer
    let activeProperties = rendererProperties;
    if (contextScenario?.globalStyleKeyword) {
      // Context scenario registered — use its element keyword
      activeProperties = getRendererPropertyCompletionsByElementType(
        rendererId,
        contextScenario.globalStyleKeyword,
      );
    } else if (!isStyleContext) {
      // Fallback: detect *keyword{ pattern from matched text
      const keywordMatch = /^\*(\w+)\{/.exec(match.text);
      if (keywordMatch) {
        const canonicalKeyword = GLOBAL_STYLE_KEYWORD_MAP.get(keywordMatch[1]);
        if (canonicalKeyword) {
          activeProperties = getRendererPropertyCompletionsByElementType(
            rendererId,
            canonicalKeyword,
          );
        }
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
