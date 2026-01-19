// Available autocompletion token types documented at
// https://codemirror.net/docs/ref/#autocomplete.Completion.type
export enum TokenType {
  Variable = "variable",
  StyleTag = "interface",
  Keyword = "keyword",
  Namespace = "namespace",
}

export enum ContextScenarioType {
  ValueName,
  QualifiedName,
  StyleArgList,
  Statement,
}

// A autocompletable range where specific token types are expected
export interface ContextScenario {
  type: ContextScenarioType;
  from: number;
  to: number;
}

// An autocompletion token definition
export interface TokenInfo {
  type: TokenType;
  value: string;
  endPosition: number;
}

// A nestible namespace with its own completion index
export interface NamespaceInfo {
  name: string;
  completionIndex: CompletionIndex;
  startPosition: number;
  endPosition: number;
}

export const ScenarioToTokenTypes: Record<
  ContextScenarioType,
  Set<TokenType>
> = {
  [ContextScenarioType.ValueName]: new Set([
    TokenType.Variable,
    TokenType.Keyword,
    TokenType.Namespace,
  ]),
  [ContextScenarioType.QualifiedName]: new Set([
    TokenType.Variable,
    TokenType.Namespace,
  ]),
  [ContextScenarioType.StyleArgList]: new Set([
    TokenType.StyleTag,
    TokenType.Namespace,
  ]),
  [ContextScenarioType.Statement]: new Set([TokenType.Keyword]),
};

// This is a simple implementation. There is room for optimization here using
// binary search (since tokens are processed in order - enforce via test cases)
// and tries for prefix matching.
export class CompletionIndex {
  readonly tokens: TokenInfo[];
  readonly contextScenarios: ContextScenario[];
  readonly namespaces: NamespaceInfo[];

  constructor(
    tokenInfo: TokenInfo[] = [],
    contextScenarios: ContextScenario[] = [],
    namespaces: NamespaceInfo[] = [],
  ) {
    this.tokens = tokenInfo;
    this.contextScenarios = contextScenarios;
    this.namespaces = namespaces;
  }

  get Tokens(): TokenInfo[] {
    return this.tokens;
  }

  get ContextScenarios(): ContextScenario[] {
    return this.contextScenarios;
  }

  get Namespaces(): NamespaceInfo[] {
    return this.namespaces;
  }

  getTokensUpTo(position: number): TokenInfo[] {
    return this.tokens.filter((token) => token.endPosition < position);
  }

  getContextScenarioAt(position: number): ContextScenario | null {
    const scenario = this.contextScenarios.find(
      (s) => s.from <= position && s.to >= position,
    );
    if (scenario) return scenario;

    const nsInfo = this.getNamespaceAt(position);
    if (nsInfo) {
      return nsInfo.completionIndex.getContextScenarioAt(position);
    }

    return null;
  }

  getNamespaceAt(position: number): NamespaceInfo | null {
    const isNamespaceInRange = (nsInfo: NamespaceInfo) =>
      nsInfo.startPosition <= position && nsInfo.endPosition >= position;
    return this.namespaces.find(isNamespaceInRange) || null;
  }

  getNestedCompletionIndexChainAt(position: number): CompletionIndex[] {
    const chain: CompletionIndex[] = [];
    chain.push(this);
    let nsInfo = this.getNamespaceAt(position);
    while (nsInfo) {
      chain.push(nsInfo.completionIndex);
      nsInfo = nsInfo.completionIndex.getNamespaceAt(position);
    }
    return chain;
  }

  getTokensAvailableAt(position: number): TokenInfo[] {
    const tokensInCurrent = this.getTokensUpTo(position);
    const curNamespace = this.getNamespaceAt(position);
    const availableTokensInNamespace =
      curNamespace?.completionIndex.getTokensAvailableAt(position) ?? [];
    return [...tokensInCurrent, ...availableTokensInNamespace];
  }

  dumpCompletionIndex(): string {
    function formatTokenLine(
      token: TokenInfo,
      index: number,
      indent: number,
    ): string {
      const indentStr = "\t".repeat(indent);
      return `${indentStr}[${index}] ${token.type}: "${token.value}" (ends at ${token.endPosition})`;
    }

    function formatScenarioLine(
      scenario: ContextScenario,
      index: number,
      indent: number,
    ): string {
      const indentStr = "\t".repeat(indent);
      return `${indentStr}[${index}] ${ContextScenarioType[scenario.type]}: ${scenario.from}-${scenario.to}`;
    }

    function dumpCompletionIndexRecursive(
      tokens: TokenInfo[],
      scenarios: ContextScenario[],
      namespaces: NamespaceInfo[],
      indent: number,
    ): string[] {
      const tokenLines = tokens.map((token, i) =>
        formatTokenLine(token, i, indent + 1),
      );
      const scenarioLines = scenarios.map((scenario, i) =>
        formatScenarioLine(scenario, i, indent + 1),
      );

      const namespaceLines = namespaces.flatMap((namespaceInfo) => {
        const namespaceIndentStr = "\t".repeat(indent + 1);
        const header = `${namespaceIndentStr}"${namespaceInfo.name}": start=${namespaceInfo.startPosition}, end=${namespaceInfo.endPosition}`;
        const nestedSections = dumpCompletionIndexRecursive(
          namespaceInfo.completionIndex.tokens,
          namespaceInfo.completionIndex.contextScenarios,
          namespaceInfo.completionIndex.namespaces,
          indent + 1,
        );
        return [header, ...nestedSections];
      });

      const indentStr = "\t".repeat(indent);
      return [
        `${indentStr}Tokens (${tokens.length}):`,
        ...tokenLines,
        `${indentStr}Context Scenarios (${scenarios.length}):`,
        ...scenarioLines,
        `${indentStr}Namespaces (${namespaces.length}):`,
        ...namespaceLines,
      ];
    }

    return dumpCompletionIndexRecursive(
      this.tokens,
      this.contextScenarios,
      this.namespaces,
      0,
    ).join("\n");
  }
}
