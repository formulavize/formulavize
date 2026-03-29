import {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

import { CompletionIndex, ContextScenarioType } from "./autocompletion";

export function createRendererPropertyCompletionSource(
  completionIndex: CompletionIndex,
  rendererProperties: Completion[],
): CompletionSource {
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
      match = context.matchBefore(/\{[^{}]*?(?:^|;)\s*[\w-]*/);
    }

    if (!match || (match.from === match.to && !context.explicit)) return null;

    // Extract the property name prefix from the match
    let word: string;
    let from: number;
    if (isStyleContext) {
      word = match.text;
      from = match.from;
    } else {
      // Extract trailing word from fallback match
      const wordMatch = /(?:^|;)\s*([\w-]*)$/.exec(match.text);
      if (!wordMatch) return null;
      word = wordMatch[1];
      from = match.to - word.length;
    }

    const filtered = rendererProperties.filter((c) => c.label.startsWith(word));

    return {
      from,
      options: filtered,
    };
  };
}
