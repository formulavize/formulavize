// Available autocompletion token types documented at
// https://codemirror.net/docs/ref/#autocomplete.Completion.type
export enum TokenType {
  Variable = "variable",
  StyleTag = "interface",
  Keyword = "keyword",
}

export interface TokenRecord {
  type: TokenType;
  value: string;
  endPosition: number;
}

export class ASTCompletionIndex {
  readonly tokens: TokenRecord[];

  constructor(tokenRecords: TokenRecord[]) {
    this.tokens = tokenRecords;
  }

  get Tokens(): TokenRecord[] {
    return this.tokens;
  }

  getTokensUpTo(position: number): TokenRecord[] {
    return this.tokens.filter((token) => token.endPosition < position);
  }
}
