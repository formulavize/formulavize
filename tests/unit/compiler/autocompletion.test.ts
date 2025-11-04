import { describe, test, expect, beforeEach } from "vitest";
import {
  TokenType,
  ContextScenarioType,
  TokenInfo,
  NamespaceInfo,
  ContextScenario,
  ASTCompletionIndex,
} from "src/compiler/autocompletion";

describe("ASTCompletionIndex", () => {
  let tokenInfo: TokenInfo[];
  let contextScenarios: ContextScenario[];
  let namespaces: NamespaceInfo[];
  let completionIndex: ASTCompletionIndex;

  beforeEach(() => {
    tokenInfo = [
      { type: TokenType.Variable, value: "x", endPosition: 10 },
      { type: TokenType.Variable, value: "y", endPosition: 20 },
      { type: TokenType.Keyword, value: "kw", endPosition: 30 },
      { type: TokenType.Namespace, value: "ns", endPosition: 40 },
    ];

    contextScenarios = [
      { type: ContextScenarioType.ValueName, from: 0, to: 15 },
      { type: ContextScenarioType.Statement, from: 25, to: 35 },
    ];

    const nestedCompletionIndex = new ASTCompletionIndex(
      [{ type: TokenType.Variable, value: "z", endPosition: 50 }],
      [{ type: ContextScenarioType.QualifiedName, from: 45, to: 55 }],
    );

    namespaces = [
      {
        name: "ns",
        completionIndex: nestedCompletionIndex,
        startPosition: 40,
        endPosition: 60,
      },
    ];

    completionIndex = new ASTCompletionIndex(
      tokenInfo,
      contextScenarios,
      namespaces,
    );
  });

  describe("getTokensUpTo", () => {
    test("returns tokens that end before the given position", () => {
      const tokens = completionIndex.getTokensUpTo(25);
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toEqual({
        type: TokenType.Variable,
        value: "x",
        endPosition: 10,
      });
      expect(tokens[1]).toEqual({
        type: TokenType.Variable,
        value: "y",
        endPosition: 20,
      });
    });

    test("returns empty array when position is before all tokens", () => {
      const tokens = completionIndex.getTokensUpTo(5);
      expect(tokens).toEqual([]);
    });

    test("returns all tokens when position is after all tokens", () => {
      const tokens = completionIndex.getTokensUpTo(50);
      expect(tokens).toEqual(tokenInfo);
    });
  });

  describe("getContextScenarioAt", () => {
    test("returns scenario when position is within range", () => {
      const scenario = completionIndex.getContextScenarioAt(10);
      expect(scenario).toEqual({
        type: ContextScenarioType.ValueName,
        from: 0,
        to: 15,
      });
    });

    test("returns scenario when position is at boundary", () => {
      const scenarioAtStart = completionIndex.getContextScenarioAt(0);
      expect(scenarioAtStart).toEqual({
        type: ContextScenarioType.ValueName,
        from: 0,
        to: 15,
      });

      const scenarioAtEnd = completionIndex.getContextScenarioAt(15);
      expect(scenarioAtEnd).toEqual({
        type: ContextScenarioType.ValueName,
        from: 0,
        to: 15,
      });
    });

    test("returns null when position is outside all scenarios", () => {
      const scenario = completionIndex.getContextScenarioAt(100);
      expect(scenario).toBeNull();
    });
  });

  describe("getNamespaceAt", () => {
    test("returns namespace when position is within range", () => {
      const namespace = completionIndex.getNamespaceAt(50);
      expect(namespace).toBe(namespaces[0]);
    });

    test("returns namespace when position is at boundary", () => {
      const namespaceAtStart = completionIndex.getNamespaceAt(40);
      expect(namespaceAtStart).toBe(namespaces[0]);

      const namespaceAtEnd = completionIndex.getNamespaceAt(60);
      expect(namespaceAtEnd).toBe(namespaces[0]);
    });

    test("returns null when position is outside all namespaces", () => {
      const namespace = completionIndex.getNamespaceAt(100);
      expect(namespace).toBeNull();
    });

    test("returns null when no namespaces exist", () => {
      const emptyIndex = new ASTCompletionIndex();
      const namespace = emptyIndex.getNamespaceAt(50);
      expect(namespace).toBeNull();
    });
  });

  describe("getNestedCompletionIndexChainAt", () => {
    test("returns chain with only root index when position is outside namespaces", () => {
      const chain = completionIndex.getNestedCompletionIndexChainAt(10);
      expect(chain).toHaveLength(1);
      expect(chain[0]).toBe(completionIndex);
    });

    test("returns chain with root and nested index when position is in namespace", () => {
      const chain = completionIndex.getNestedCompletionIndexChainAt(50);
      expect(chain).toHaveLength(2);
      expect(chain[0]).toBe(completionIndex);
      expect(chain[1]).toBe(namespaces[0].completionIndex);
    });
  });

  describe("getTokensAvailableAt", () => {
    test("returns tokens from current scope when position is outside namespaces", () => {
      const tokens = completionIndex.getTokensAvailableAt(15);
      expect(tokens).toHaveLength(1); // Only token "x" ends before position 15
      expect(tokens).toContainEqual({
        type: TokenType.Variable,
        value: "x",
        endPosition: 10,
      });
    });

    test("returns tokens from current and nested scopes when position is in namespace", () => {
      const tokens = completionIndex.getTokensAvailableAt(50);
      expect(tokens).toHaveLength(4);
      // All 4 tokens from current scope (end before 50), no tokens from nested scope
      // Tokens from current scope up to position 50
      expect(tokens).toContainEqual({
        type: TokenType.Variable,
        value: "x",
        endPosition: 10,
      });
      expect(tokens).toContainEqual({
        type: TokenType.Variable,
        value: "y",
        endPosition: 20,
      });
      expect(tokens).toContainEqual({
        type: TokenType.Keyword,
        value: "kw",
        endPosition: 30,
      });
      expect(tokens).toContainEqual({
        type: TokenType.Namespace,
        value: "ns",
        endPosition: 40,
      });
      // The "z" token ends at exactly 50, so it won't be included (< comparison, not <=)
    });

    test("returns tokens from nested scope when position is beyond nested token", () => {
      const tokens = completionIndex.getTokensAvailableAt(55);
      expect(tokens).toHaveLength(5); // All 4 from current + 1 from nested
      // All current scope tokens
      expect(tokens).toContainEqual({
        type: TokenType.Variable,
        value: "x",
        endPosition: 10,
      });
      expect(tokens).toContainEqual({
        type: TokenType.Variable,
        value: "y",
        endPosition: 20,
      });
      expect(tokens).toContainEqual({
        type: TokenType.Keyword,
        value: "kw",
        endPosition: 30,
      });
      expect(tokens).toContainEqual({
        type: TokenType.Namespace,
        value: "ns",
        endPosition: 40,
      });
      // Now the "z" token should be included since 50 < 55
      expect(tokens).toContainEqual({
        type: TokenType.Variable,
        value: "z",
        endPosition: 50,
      });
    });

    test("returns empty array when no tokens are available", () => {
      const emptyIndex = new ASTCompletionIndex();
      const tokens = emptyIndex.getTokensAvailableAt(10);
      expect(tokens).toEqual([]);
    });
  });
});
