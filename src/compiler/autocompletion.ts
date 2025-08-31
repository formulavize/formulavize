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
  StyleArgList,
  Statement,
}

export interface ContextScenario {
  type: ContextScenarioType;
  from: number;
  to: number;
}

export interface TokenInfo {
  type: TokenType;
  value: string;
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
  [ContextScenarioType.StyleArgList]: new Set([
    TokenType.StyleTag,
    TokenType.Namespace,
  ]),
  [ContextScenarioType.Statement]: new Set([TokenType.Keyword]),
};

export class ASTCompletionIndex {
  readonly tokens: TokenInfo[];
  readonly contextScenarios: ContextScenario[];

  constructor(tokenInfo: TokenInfo[], contextScenarios: ContextScenario[]) {
    this.tokens = tokenInfo;
    this.contextScenarios = contextScenarios;
  }

  get Tokens(): TokenInfo[] {
    return this.tokens;
  }

  get ContextScenarios(): ContextScenario[] {
    return this.contextScenarios;
  }

  getTokensUpTo(position: number): TokenInfo[] {
    return this.tokens.filter((token) => token.endPosition < position);
  }

  getContextScenarioAt(position: number): ContextScenario | null {
    const scenario = this.contextScenarios.find(
      (s) => s.from <= position && s.to >= position,
    );
    return scenario || null;
  }

  dumpCompletionIndex(): string {
    const tokenLines = this.tokens.map(
      (token, i) =>
        `  [${i}] ${token.type}: "${token.value}" (ends at ${token.endPosition})`,
    );

    const scenarioLines = this.contextScenarios.map(
      (scenario, i) =>
        `  [${i}] ${ContextScenarioType[scenario.type]}: ${scenario.from}-${scenario.to}`,
    );

    return [
      `Tokens (${this.tokens.length}):`,
      ...tokenLines,
      "",
      `Context Scenarios (${this.contextScenarios.length}):`,
      ...scenarioLines,
      "",
    ].join("\n");
  }
}
