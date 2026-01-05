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

    // Match word at the beginning of the current line, after semicolon, or after opening bracket
    const match = context.matchBefore(/(?:^|;|\[)\s*\w*$/);
    if (!match || (match.from === match.to && !context.explicit)) {
      return null;
    }

    // Extract the matched word (after the start of line, last semicolon, or opening bracket)
    const wordMatch = match.text.match(/(?:^|;|\[)\s*(\w*)$/);
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

export function createCallCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    // Check if we're in a ValueName context scenario
    const contextScenario = completionIndex.getContextScenarioAt(context.pos);
    if (contextScenario?.type === ContextScenarioType.ValueName) {
      // Match any word characters handling multi-line call arguments
      const match = context.matchBefore(/\w*/);
      if (!match || (match.from === match.to && !context.explicit)) {
        return null;
      }

      return createCompletions(
        completionIndex,
        context.pos,
        ScenarioToTokenTypes[ContextScenarioType.ValueName],
        match.text,
        match.from,
      );
    }

    // Fallback: Match a word after an open bracket or after a comma
    // This is needed because autocompletion looks at ASTCompletionIndex
    // immediately while the parser awaits debouncing logic so the new
    // context scenario has not yet been registered in ASTCompletionIndex.
    const match = context.matchBefore(/\((?:[^,()]*,\s*)*\s*\w*|,\s*\w*/);
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

    return createCompletions(
      completionIndex,
      context.pos,
      ScenarioToTokenTypes[ContextScenarioType.ValueName],
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
    // If not (e.g. new context not yet registered because of debouncing),
    // check for other valid scenario with an opening brace pattern.
    const contextScenario = completionIndex.getContextScenarioAt(context.pos);
    const isStyleContext =
      contextScenario?.type === ContextScenarioType.StyleArgList;
    const match = isStyleContext
      ? context.matchBefore(/#\w*/)
      : context.matchBefore(/\{[^{}]*#\w*/);

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
      apply: token.value,
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

export function resolveEndNamespace(
  completionIndex: ASTCompletionIndex,
  namespacePath: string[],
  position: number,
): ASTCompletionIndex | null {
  const nestedCompletionIndexChain =
    completionIndex.getNestedCompletionIndexChainAt(position);

  let targetCompletionIndex: ASTCompletionIndex | null = null;
  for (let i = nestedCompletionIndexChain.length - 1; i >= 0; i--) {
    const result = getEndNamespace(
      nestedCompletionIndexChain[i],
      namespacePath,
      position,
    );
    if (result !== null) {
      targetCompletionIndex = result;
      break;
    }
  }

  // Return the innermost namespace's completion index
  return targetCompletionIndex;
}

export function createQualifiedVariableCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const contextScenario = completionIndex.getContextScenarioAt(context.pos);

    let qualifiedName = "";
    let matchTo = context.pos;

    if (
      contextScenario &&
      contextScenario.type === ContextScenarioType.ValueName
    ) {
      // Match qualified variable names: word characters separated by dots
      const match = context.matchBefore(/\w+(?:\.\w*)*/);
      if (match && (match.from !== match.to || context.explicit)) {
        qualifiedName = match.text;
        matchTo = match.to;
      }
    } else if (!contextScenario) {
      // Fallback: Match qualified variable names after an open bracket or after a comma
      const match = context.matchBefore(
        /\((?:[^,()]*,\s*)*\w+(?:\.\w*)*|,\s*\w+(?:\.\w*)*/,
      );
      if (match && (match.from !== match.to || context.explicit)) {
        // Find the last separator (either '(' or ',') and extract the qualified name after it
        const separatorMatch = match.text.includes(",")
          ? /,\s*(\w+(?:\.\w*)*)$/.exec(match.text)
          : /\(\s*(\w+(?:\.\w*)*)$/.exec(match.text);

        if (separatorMatch) {
          qualifiedName = separatorMatch[1];
          matchTo = match.to;
        }
      }
    }

    if (!qualifiedName) {
      return null;
    }

    const parts = qualifiedName.split(".");

    // If there's no dot, this isn't a qualified name
    if (parts.length < 2) {
      return null;
    }

    const namespacePath = parts.slice(0, -1);
    const partialVariable = parts[parts.length - 1];

    const endNamespace = resolveEndNamespace(
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
      matchTo - partialVariable.length,
    );
  };
}

export function createQualifiedStyleCompletionSource(
  completionIndex: ASTCompletionIndex,
): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const contextScenario = completionIndex.getContextScenarioAt(context.pos);

    let qualifiedName = "";
    let matchTo = context.pos;

    if (
      contextScenario &&
      contextScenario.type === ContextScenarioType.StyleArgList
    ) {
      // Match qualified style names: word characters separated by dots, starting with a hashtag
      const match = context.matchBefore(/#\w+(?:\.\w*)*/);
      if (match && (match.from !== match.to || context.explicit)) {
        qualifiedName = match.text.slice(1); // Remove the leading '#'
        matchTo = match.to;
      }
    } else if (!contextScenario) {
      // Fallback: Match qualified style names within curly brackets
      const match = context.matchBefore(/\{[^{}]*#\w+(?:\.\w*)*/);
      if (match && (match.from !== match.to || context.explicit)) {
        // Find the hashtag and extract the qualified name after it
        const hashtagMatch = /#(\w+(?:\.\w*)*)$/.exec(match.text);
        if (hashtagMatch) {
          qualifiedName = hashtagMatch[1];
          matchTo = match.to;
        }
      }
    }

    if (!qualifiedName) {
      return null;
    }

    const parts = qualifiedName.split(".");

    // If there's no dot, this isn't a qualified name
    if (parts.length < 2) {
      return null;
    }

    const namespacePath = parts.slice(0, -1);
    const partialStyle = parts[parts.length - 1];

    const endNamespace = resolveEndNamespace(
      completionIndex,
      namespacePath,
      context.pos,
    );
    if (!endNamespace) {
      return null;
    }

    // Filter for styles and namespaces that match the partial name
    const applicableTokenTypes =
      ScenarioToTokenTypes[ContextScenarioType.StyleArgList];

    return createNamespacedCompletions(
      endNamespace,
      context.pos,
      applicableTokenTypes,
      namespacePath.join(".") + ".",
      partialStyle,
      matchTo - partialStyle.length,
    );
  };
}

export function getAllDynamicCompletionSources(
  completionIndex: ASTCompletionIndex,
): CompletionSource[] {
  const sources = [
    createQualifiedVariableCompletionSource,
    createQualifiedStyleCompletionSource,
    createAssignmentRhsCompletionSource,
    createCallCompletionSource,
    createStyleCompletionSource,
    createStatementCompletionSource,
  ];
  return sources.map((sourceFn) => sourceFn(completionIndex));
}
