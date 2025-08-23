// Available autocompletion token types documented at
// https://codemirror.net/docs/ref/#autocomplete.Completion.type
export enum TokenType {
  Variable = "variable",
  StyleTag = "interface",
  Keyword = "keyword",
}

export enum ContextScenarioType {
  AssignmentRhs,
  StyleArgList,
  VarStatement,
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
  [ContextScenarioType.AssignmentRhs]: new Set([
    TokenType.Variable,
    TokenType.Keyword,
  ]),
  [ContextScenarioType.StyleArgList]: new Set([TokenType.StyleTag]),
  [ContextScenarioType.VarStatement]: new Set([TokenType.Keyword]),
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

  getApplicableTokenTypesAt(position: number): Set<TokenType> {
    const scenario = this.getContextScenarioAt(position);
    if (!scenario) return new Set();
    return ScenarioToTokenTypes[scenario.type] || new Set();
  }
}
