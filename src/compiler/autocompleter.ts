import {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

import {
  ASTCompletionIndex,
  ContextScenarioType,
  ScenarioToTokenTypes,
  TokenType,
} from "./autocompletion";

export function createCompletions(
  completionIndex: ASTCompletionIndex,
  position: number,
  applicableTokenTypes: Set<TokenType>,
  word: string,
  from: number,
): CompletionResult {
  const availableTokens = completionIndex.getTokensAvailableAt(position);
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
}

export function createStatementCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Check if we're already in a specific context scenario
    const contextScenario = completionIndex.getContextScenarioAt(context.pos);
    if (contextScenario) {
      return null; // Let other completion sources handle specific contexts
    }

    // Match word at the beginning of the current line or after semicolon
    const match = context.matchBefore(/(?:^|;)\s*\w*$/);
    if (!match || (match.from === match.to && !context.explicit)) {
      return null;
    }

    // Extract the matched word (after the start of line or last semicolon)
    const wordMatch = match.text.match(/(?:^|;)\s*(\w*)$/);
    const word = wordMatch ? wordMatch[1] : "";
    const from = match.to - word.length;

    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.Statement];

    return createCompletions(
      completionIndex,
      context.pos,
      applicableTokenTypes,
      word,
      from,
    );
  };
}

export function createOpeningNamespaceCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // This source triggers when the user types an opening square bracket '['.

    // Match word at the beginning of a square bracket or after semicolon within brackets
    const match = context.matchBefore(/\[(?:[^[\]]*;)?\s*\w*/);
    if (!match || (match.from === match.to && !context.explicit)) {
      return null;
    }

    // Extract the matched word (after the start of bracket or last semicolon)
    const wordMatch = match.text.match(/(?:\[|;)\s*(\w*)$/);
    const word = wordMatch ? wordMatch[1] : "";
    const from = match.to - word.length;

    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.Statement];

    return createCompletions(
      completionIndex,
      context.pos,
      applicableTokenTypes,
      word,
      from,
    );
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

    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.ValueName];

    return createCompletions(
      completionIndex,
      context.pos,
      applicableTokenTypes,
      word,
      from,
    );
  };
}

export function createOpeningCallCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // This source triggers when the user types an opening parenthesis '('.
    // This is needed because autocompletion looks at ASTCompletionIndex
    // immediately while the parser awaits debouncing logic so the new
    // context scenario has not yet been registered in ASTCompletionIndex.

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

    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.ValueName];

    return createCompletions(
      completionIndex,
      context.pos,
      applicableTokenTypes,
      word,
      from,
    );
  };
}

export function createCallCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Check if we're in a ValueName context scenario
    const contextScenario = completionIndex.getContextScenarioAt(context.pos);
    if (contextScenario?.type !== ContextScenarioType.ValueName) {
      return null;
    }

    // Match any word characters handling multi-line call arguments
    const match = context.matchBefore(/\w*/);
    if (!match || (match.from === match.to && !context.explicit)) {
      return null;
    }

    const word = match.text;
    const from = match.from;

    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.ValueName];

    return createCompletions(
      completionIndex,
      context.pos,
      applicableTokenTypes,
      word,
      from,
    );
  };
}

export function createOpeningStyleCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // This source triggers when the user types an opening curly bracket '{'.
    // This is needed because autocompletion looks at ASTCompletionIndex
    // immediately while the parser awaits debouncing logic so the new
    // context scenario has not yet been registered in ASTCompletionIndex.

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

    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.StyleArgList];

    return createCompletions(
      completionIndex,
      context.pos,
      applicableTokenTypes,
      word,
      from,
    );
  };
}

export function createStyleCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Check if we're in a StyleArgList context scenario
    const contextScenario = completionIndex.getContextScenarioAt(context.pos);
    if (contextScenario?.type !== ContextScenarioType.StyleArgList) {
      return null;
    }

    // Match hashtag followed by word characters
    const match = context.matchBefore(/#\w*/);
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

    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.StyleArgList];

    return createCompletions(
      completionIndex,
      context.pos,
      applicableTokenTypes,
      word,
      from,
    );
  };
}

export function getAllDynamicCompletionSources(
  completionIndex: ASTCompletionIndex,
): CompletionSource[] {
  const sources = [
    createAssignmentRhsCompletionSource,
    createOpeningCallCompletionSource,
    createCallCompletionSource,
    createOpeningStyleCompletionSource,
    createStyleCompletionSource,
    createOpeningNamespaceCompletionSource,
    createStatementCompletionSource,
  ];
  return sources.map((sourceFn) => sourceFn(completionIndex));
}
