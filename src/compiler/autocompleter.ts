import {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

import { ASTCompletionIndex } from "./autocompletion";

export function createCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const availableTokens = completionIndex.getTokensUpTo(context.pos);
    const completions = availableTokens
      .filter((token) => token.value.startsWith(word.text))
      .map((token) => ({
        label: token.value,
        type: token.type,
      }));

    return {
      from: word.from,
      options: completions,
    };
  };
}
