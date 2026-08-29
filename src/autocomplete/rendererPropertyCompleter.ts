import {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

import { CompletionIndex, ContextScenarioType } from "./autocompletion";
import {
  getRendererPropertyCompletions,
  getRendererPropertyCompletionsByElementType,
  getRendererDirectiveCompletions,
} from "./rendererProperties";
import { GLOBAL_STYLE_KEYWORD_MAP } from "../compiler/constants";

export function createRendererPropertyCompletionSource(
  completionIndex: CompletionIndex,
  rendererName: string,
): CompletionSource {
  const rendererProperties = getRendererPropertyCompletions(rendererName);

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
      match = context.matchBefore(/[*^]?\w*\{(?:[^{}]*[;{])?\s*[\w-]*/);
    }

    if (!match || (match.from === match.to && !context.explicit)) return null;

    // Determine which properties to offer
    let activeProperties = rendererProperties;
    if (contextScenario?.rendererDirectiveName !== undefined) {
      // A block addressed to another renderer has nothing we can suggest.
      activeProperties =
        contextScenario.rendererDirectiveName === rendererName
          ? getRendererDirectiveCompletions(
              rendererName,
              contextScenario.rendererDirectiveLayout,
            )
          : [];
    } else if (contextScenario?.globalStyleKeyword) {
      // Context scenario registered — use its element keyword
      activeProperties = getRendererPropertyCompletionsByElementType(
        rendererName,
        contextScenario.globalStyleKeyword,
      );
    } else if (!isStyleContext) {
      // Fallback: detect *keyword{ or ^rendererName{ pattern from matched text
      const keywordMatch = /^\*(\w+)\{/.exec(match.text);
      const directiveMatch = /^\^(\w+)\{/.exec(match.text);
      if (keywordMatch) {
        const canonicalKeyword = GLOBAL_STYLE_KEYWORD_MAP.get(keywordMatch[1]);
        if (canonicalKeyword) {
          activeProperties = getRendererPropertyCompletionsByElementType(
            rendererName,
            canonicalKeyword,
          );
        }
      } else if (directiveMatch) {
        // The block's own 'layout:' declaration narrows what we can offer.
        const layoutMatch = /\blayout\s*:\s*"?([\w-]+)"?/.exec(match.text);
        activeProperties =
          directiveMatch[1] === rendererName
            ? getRendererDirectiveCompletions(rendererName, layoutMatch?.[1])
            : [];
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
