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

export function createNamespacedCompletions(
  completionIndex: ASTCompletionIndex,
  position: number,
  applicableTokenTypes: Set<TokenType>,
  namespacePrefix: string,
  word: string,
  from: number,
): CompletionResult {
  const availableTokens = completionIndex.getTokensUpTo(position);
  const completions = availableTokens
    .filter((token) => applicableTokenTypes.has(token.type))
    .filter((token) => token.value.startsWith(word))
    .map((token) => ({
      label: namespacePrefix + token.value,
      type: token.type,
    }));

  return {
    from,
    options: completions,
  };
}

export function getEndNamespace(
  completionIndex: ASTCompletionIndex,
  namespacePath: string[],
  position: number,
): ASTCompletionIndex | null {
  // Start searching from the current namespace
  let searchIndex = completionIndex;

  // Navigate to the target namespace by following the path
  // Assumes namespaces are added in the order they are defined
  // Use findLast to ensure we get the most recent definition before the current position
  for (const namespaceName of namespacePath) {
    const targetNamespace = searchIndex.namespaces.findLast(
      (ns) => ns.name === namespaceName && ns.endPosition < position,
    );

    // If we can't find the namespace or it's not defined before current position, return no completions
    if (!targetNamespace) {
      return null;
    }

    searchIndex = targetNamespace.completionIndex;
  }

  return searchIndex;
}

export function createQualifiedVariableCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Allow completions in ValueName contexts only
    const contextScenario = completionIndex.getContextScenarioAt(context.pos);
    if (
      !contextScenario ||
      contextScenario.type !== ContextScenarioType.ValueName
    ) {
      return null;
    }

    // Match qualified variable names: word characters separated by dots
    const match = context.matchBefore(/\w+(?:\.\w*)*/);
    if (!match || (match.from === match.to && !context.explicit)) {
      return null;
    }

    const qualifiedName = match.text;
    const parts = qualifiedName.split(".");

    // If there's no dot, this isn't a qualified name
    if (parts.length < 2) {
      return null;
    }

    const namespacePath = parts.slice(0, -1);
    const partialVariable = parts[parts.length - 1];

    const endNamespace = getEndNamespace(
      completionIndex,
      namespacePath,
      context.pos,
    );
    if (!endNamespace) {
      return null;
    }

    // Filter for variables and namespaces that match the partial name
    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.QualifiedName];

    return createNamespacedCompletions(
      endNamespace,
      context.pos,
      applicableTokenTypes,
      namespacePath.join(".") + ".",
      partialVariable,
      match.from,
    );
  };
}

export function getAllDynamicCompletionSources(
  completionIndex: ASTCompletionIndex,
): CompletionSource[] {
  const sources = [
    createQualifiedVariableCompletionSource,
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
