import {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

import {
  ASTCompletionIndex,
  ContextScenarioType,
  ScenarioToTokenTypes,
} from "./autocompletion";

export function createCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const availableTokens = completionIndex.getTokensUpTo(context.pos);
    const applicableTokenTypes = completionIndex.getApplicableTokenTypesAt(
      context.pos,
    );
    const completions = availableTokens
      .filter((token) => applicableTokenTypes.has(token.type))
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

export function createAssignmentRhsCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Match a word after an equal sign
    const match = context.matchBefore(/=\s*\w*/);
    if (!match || (match.from === match.to && !context.explicit)) {
      return null;
    }

    // Adjust the start position to just after the equal sign and spaces
    const matchStart = /=\s*/.exec(match.text);
    const from = matchStart ? match.from + matchStart[0].length : match.from;
    const word = match.text.slice(from - match.from);

    const availableTokens = completionIndex.getTokensUpTo(context.pos);
    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.ValueName];

    const completions = availableTokens
      .filter((token) => applicableTokenTypes.has(token.type))
      .filter((token) => token.value.startsWith(word))
      .map((token) => ({
        label: token.value,
        type: token.type,
      }));

    return {
      from,
      options: completions,
    };
  };
}

export function createCallCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Match a word after an open bracket or after a comma
    const match = context.matchBefore(/\((?:[^,()]*,\s*)*\w*|,\s*\w*/);
    if (!match || (match.from === match.to && !context.explicit)) {
      return null;
    }

    // Find the last separator (either '(' or ',') and extract the word after it
    const separatorMatch = match.text.includes(",")
      ? /,\s*(\w*)$/.exec(match.text)
      : /\(\s*(\w*)$/.exec(match.text);

    if (!separatorMatch) {
      return null;
    }

    const word = separatorMatch[1];
    const from = match.to - word.length;

    const availableTokens = completionIndex.getTokensUpTo(context.pos);
    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.ValueName];

    const completions = availableTokens
      .filter((token) => applicableTokenTypes.has(token.type))
      .filter((token) => token.value.startsWith(word))
      .map((token) => ({
        label: token.value,
        type: token.type,
      }));

    return {
      from,
      options: completions,
    };
  };
}

export function createStyleCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Match content within curly brackets that contains a hashtag followed by word characters
    const match = context.matchBefore(/\{[^{}]*#\w*/);
    if (!match || (match.from === match.to && !context.explicit)) {
      return null;
    }

    // Find the hashtag and extract the word after it
    const hashtagMatch = /#(\w*)$/.exec(match.text);
    if (!hashtagMatch) {
      return null;
    }

    const word = hashtagMatch[1];
    const from = match.to - word.length;

    const availableTokens = completionIndex.getTokensUpTo(context.pos);
    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.StyleArgList];

    const completions = availableTokens
      .filter((token) => applicableTokenTypes.has(token.type))
      .filter((token) => token.value.startsWith(word))
      .map((token) => ({
        label: token.value,
        type: token.type,
      }));

    return {
      from,
      options: completions,
    };
  };
}
