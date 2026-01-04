import { describe, test, expect, beforeEach } from "vitest";
import { CompletionContext, CompletionSource } from "@codemirror/autocomplete";
import {
  createCompletions,
  createStatementCompletionSource,
  createOpeningNamespaceCompletionSource,
  createAssignmentRhsCompletionSource,
  createCallCompletionSource,
  createStyleCompletionSource,
  createNamespacedCompletions,
  getEndNamespace,
  resolveEndNamespace,
  createOpeningQualifiedVariableCompletionSource,
  createQualifiedVariableCompletionSource,
  createOpeningQualifiedStyleCompletionSource,
  createQualifiedStyleCompletionSource,
  getAllDynamicCompletionSources,
} from "src/compiler/autocompleter";
import {
  ASTCompletionIndex,
  ContextScenarioType,
  TokenType,
  TokenInfo,
  NamespaceInfo,
  ContextScenario,
} from "src/compiler/autocompletion";

// Mock CompletionContext for testing
function createMockContext(
  pos: number,
  text: string,
  explicit: boolean = false,
): CompletionContext {
  return {
    pos,
    explicit,
    matchBefore: (pattern: RegExp) => {
      // In CodeMirror, `pos` is an absolute document position.
      // These tests often pass only a short snippet that ends at the cursor,
      // so we left-pad the snippet to make `textBeforeCursor.length === pos`.
      const textBeforeCursor =
        text.length >= pos
          ? text.slice(0, pos)
          : " ".repeat(pos - text.length) + text;

      // Emulate `CompletionContext.matchBefore`: find a match that ends at the cursor.
      // Prefer the longest match that reaches the end (to avoid empty matches like /\w*/).
      const baseFlags = pattern.flags.replaceAll("y", "");
      const flags = baseFlags.includes("g") ? baseFlags : `${baseFlags}g`;
      const re = new RegExp(pattern.source, flags);

      let bestFrom: number | null = null;
      let bestText: string | null = null;

      let match: RegExpExecArray | null;
      while ((match = re.exec(textBeforeCursor)) !== null) {
        const from = match.index;
        const text = match[0];
        const to = from + text.length;

        if (to === textBeforeCursor.length) {
          if (bestText === null || text.length > bestText.length) {
            bestFrom = from;
            bestText = text;
          }
        }

        // Avoid infinite loops on zero-length matches.
        if (text.length === 0) {
          re.lastIndex++;
        }
      }

      if (bestFrom === null || bestText === null) return null;
      return {
        from: bestFrom,
        to: textBeforeCursor.length,
        text: bestText,
      };
    },
    // Add other required CompletionContext properties as stubs
    state: {} as unknown as CompletionContext["state"],
    aborted: false,
    tokenBefore: () => null,
  } as unknown as CompletionContext;
}

const runSource = (source: CompletionSource, ctx: CompletionContext) =>
  Promise.resolve()
    .then(() => source(ctx))
    .catch(() => null);

function cloneWithOverrides<T extends object>(
  base: T,
  overrides: Partial<T>,
): T {
  return Object.assign(
    Object.create(Object.getPrototypeOf(base)),
    base,
    overrides,
  );
}

describe("autocompleter", () => {
  let tokenInfo: TokenInfo[];
  let contextScenarios: ContextScenario[];
  let namespaces: NamespaceInfo[];
  let completionIndex: ASTCompletionIndex;

  beforeEach(() => {
    tokenInfo = [
      { type: TokenType.Variable, value: "x", endPosition: 10 },
      { type: TokenType.Variable, value: "y", endPosition: 20 },
      { type: TokenType.Variable, value: "xyz", endPosition: 25 },
      { type: TokenType.Keyword, value: "mix", endPosition: 30 },
      { type: TokenType.Keyword, value: "import", endPosition: 35 },
      { type: TokenType.StyleTag, value: "bold", endPosition: 40 },
      { type: TokenType.StyleTag, value: "italic", endPosition: 45 },
      { type: TokenType.Namespace, value: "math", endPosition: 50 },
    ];

    contextScenarios = [
      { type: ContextScenarioType.ValueName, from: 60, to: 80 },
      { type: ContextScenarioType.StyleArgList, from: 90, to: 110 },
    ];

    const nestedCompletionIndex = new ASTCompletionIndex(
      [
        { type: TokenType.Variable, value: "sin", endPosition: 70 },
        { type: TokenType.Variable, value: "cos", endPosition: 75 },
        { type: TokenType.Namespace, value: "trig", endPosition: 80 },
      ],
      [],
    );

    namespaces = [
      {
        name: "math",
        completionIndex: nestedCompletionIndex,
        startPosition: 50,
        endPosition: 100,
      },
    ];

    completionIndex = new ASTCompletionIndex(
      tokenInfo,
      contextScenarios,
      namespaces,
    );
  });

  describe("createCompletions", () => {
    test("filters tokens by applicable types and word prefix", () => {
      const applicableTypes = new Set([TokenType.Variable]);
      const result = createCompletions(
        completionIndex,
        50,
        applicableTypes,
        "x",
        0,
      );

      expect(result.from).toBe(0);
      expect(result.options).toHaveLength(2);
      expect(result.options).toEqual([
        { label: "x", type: TokenType.Variable },
        { label: "xyz", type: TokenType.Variable },
      ]);
    });

    test("returns empty completions when no tokens match", () => {
      const applicableTypes = new Set([TokenType.Variable]);
      const result = createCompletions(
        completionIndex,
        50,
        applicableTypes,
        "notfound",
        0,
      );

      expect(result.from).toBe(0);
      expect(result.options).toHaveLength(0);
    });

    test("filters by token types correctly", () => {
      const applicableTypes = new Set([TokenType.Keyword]);
      const keywordResult = createCompletions(
        completionIndex,
        50,
        applicableTypes,
        "m",
        0,
      );

      expect(keywordResult.from).toBe(0);
      expect(keywordResult.options).toContainEqual({
        label: "mix",
        type: TokenType.Keyword,
      });
    });

    test("includes nested namespace tokens when cursor is inside a namespace", () => {
      const applicableTypes = new Set([TokenType.Variable]);
      const result = createCompletions(
        completionIndex,
        90, // inside the "math" namespace (50-100)
        applicableTypes,
        "s",
        0,
      );

      expect(result.options).toContainEqual({
        label: "sin",
        type: TokenType.Variable,
      });
      expect(result.options).not.toContainEqual({
        label: "cos",
        type: TokenType.Variable,
      });
    });

    test("does not include tokens whose endPosition equals the cursor position", () => {
      const applicableTypes = new Set([TokenType.Namespace]);
      const result = createCompletions(
        completionIndex,
        50,
        applicableTypes,
        "m",
        0,
      );

      // "math" ends at 50, and ASTCompletionIndex.getTokensUpTo uses endPosition < position.
      expect(result.options).toHaveLength(0);
    });
  });

  describe("createStatementCompletionSource", () => {
    let source: CompletionSource;

    beforeEach(() => {
      source = createStatementCompletionSource(completionIndex);
    });

    test("completes keywords at beginning of line", async () => {
      const context = createMockContext(40, "mix");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(37); // 40 - 3 ("mix")
      expect(result!.options).toContainEqual({
        label: "mix",
        type: TokenType.Keyword,
      });
    });

    test("completes keywords after semicolon", async () => {
      const context = createMockContext(40, "x = 1; im");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(38); // 40 - 2 ("im")
      expect(result!.options).toContainEqual({
        label: "import",
        type: TokenType.Keyword,
      });
    });

    test("returns null when in specific context scenario", async () => {
      // Mock getContextScenarioAt to return a scenario
      const mockIndex = cloneWithOverrides(completionIndex, {
        getContextScenarioAt: () => ({
          type: ContextScenarioType.ValueName,
          from: 0,
          to: 10,
        }),
      });
      const source = createStatementCompletionSource(mockIndex);
      const context = createMockContext(5, "mix");

      const result = await runSource(source, context);
      expect(result).toBeNull();
    });

    test("returns null when no match found", async () => {
      const context = createMockContext(5, "x = 1");
      const result = await runSource(source, context);

      expect(result).toBeNull();
    });
  });
  describe("createOpeningNamespaceCompletionSource", () => {
    let source: CompletionSource;

    beforeEach(() => {
      source = createOpeningNamespaceCompletionSource(completionIndex);
    });

    test("completes keywords at beginning of namespace", async () => {
      const context = createMockContext(40, "[mix");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(37); // 40 - 3 ("mix")
      expect(result!.options).toContainEqual({
        label: "mix",
        type: TokenType.Keyword,
      });
    });

    test("completes keywords after semicolon in namespace", async () => {
      const context = createMockContext(40, "[x = 1; import");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(34); // 40 - 6 ("import")
      expect(result!.options).toContainEqual({
        label: "import",
        type: TokenType.Keyword,
      });
    });

    test("returns null when no match found", async () => {
      const context = createMockContext(5, "x = 1");
      const result = await runSource(source, context);

      expect(result).toBeNull();
    });
  });
  describe("createAssignmentRhsCompletionSource", () => {
    let source: CompletionSource;

    beforeEach(() => {
      source = createAssignmentRhsCompletionSource(completionIndex);
    });

    test("completes variables after equals sign", async () => {
      const context = createMockContext(40, "z = x");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(39); // 40 - 1 ("x")
      expect(result!.options).toContainEqual({
        label: "x",
        type: TokenType.Variable,
      });
    });

    test("completes with spaces after equals sign", async () => {
      const context = createMockContext(40, "z =   xy");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(38); // 40 - 2 ("xy")
      expect(result!.options).toContainEqual({
        label: "xyz",
        type: TokenType.Variable,
      });
    });

    test("returns null when no equals sign found", async () => {
      const context = createMockContext(5, "xyz");
      const result = await runSource(source, context);

      expect(result).toBeNull();
    });
  });
  describe("createCallCompletionSource", () => {
    let source: CompletionSource;

    beforeEach(() => {
      const mockIndex = cloneWithOverrides(completionIndex, {
        getContextScenarioAt: (pos: number) =>
          pos >= 60 && pos <= 80
            ? { type: ContextScenarioType.ValueName, from: 60, to: 80 }
            : null,
      });
      source = createCallCompletionSource(mockIndex);
    });

    test("completes variables in ValueName context", async () => {
      const context = createMockContext(65, "x");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(64); // 65 - 1
      expect(result!.options).toContainEqual({
        label: "x",
        type: TokenType.Variable,
      });
    });

    test("returns null when not in ValueName context", async () => {
      const context = createMockContext(30, "x");
      const result = await runSource(source, context);

      expect(result).toBeNull();
    });

    test("returns no options when no word match", async () => {
      const context = createMockContext(65, "L");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(64); // 65 - 1
      expect(result!.options).toHaveLength(0);
    });
    test("completes variables after opening parenthesis", async () => {
      const context = createMockContext(40, "func(x");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(39); // 40 - 1 ("x")
      expect(result!.options).toContainEqual({
        label: "x",
        type: TokenType.Variable,
      });
    });

    test("completes variables after comma", async () => {
      const context = createMockContext(40, "func(a, xy");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(38); // 40 - 2 ("xy")
      expect(result!.options).toContainEqual({
        label: "xyz",
        type: TokenType.Variable,
      });
    });

    test("handles spaces correctly", async () => {
      const context = createMockContext(40, "func( x");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(39); // 40 - 1 ("x")
    });
  });
  describe("createStyleCompletionSource", () => {
    let source: CompletionSource;

    beforeEach(() => {
      // Mock getContextScenarioAt to return StyleArgList scenario
      const mockIndex = cloneWithOverrides(completionIndex, {
        getContextScenarioAt: (pos: number) =>
          pos >= 90 && pos <= 110
            ? { type: ContextScenarioType.StyleArgList, from: 90, to: 110 }
            : null,
      });
      source = createStyleCompletionSource(mockIndex);
    });

    test("completes style tags in StyleArgList context", async () => {
      const context = createMockContext(95, "#bold");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(91); // 95 - 4 ("bold")
      expect(result!.options).toContainEqual({
        label: "bold",
        type: TokenType.StyleTag,
      });
    });

    test("completes style tags via fallback (curly braces) when not in StyleArgList context", async () => {
      const context = createMockContext(60, "{#bold");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(56); // 60 - 4 ("bold")
      expect(result!.options).toContainEqual({
        label: "bold",
        type: TokenType.StyleTag,
      });
    });

    test("handles partial style names with opening curly brace", async () => {
      const context = createMockContext(60, "{#ital");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(56); // 60 - 4 ("ital")
      expect(result!.options).toContainEqual({
        label: "italic",
        type: TokenType.StyleTag,
      });
    });

    test("returns null when not in StyleArgList context and no curly braces", async () => {
      const context = createMockContext(30, "#bold");
      const result = await runSource(source, context);

      expect(result).toBeNull();
    });

    test("returns null when no hashtag match", async () => {
      const context = createMockContext(95, "bold");
      const result = await runSource(source, context);

      expect(result).toBeNull();
    });
  });

  describe("createNamespacedCompletions", () => {
    test("creates completions with namespace prefix", () => {
      const applicableTypes = new Set([TokenType.Variable]);
      const result = createNamespacedCompletions(
        completionIndex,
        50,
        applicableTypes,
        "ns.",
        "x",
        0,
      );

      expect(result.from).toBe(0);
      expect(result.options).toHaveLength(2);
      expect(result.options).toEqual([
        { label: "ns.x", apply: "x", type: TokenType.Variable },
        { label: "ns.xyz", apply: "xyz", type: TokenType.Variable },
      ]);
    });

    test("filters by prefix correctly", () => {
      const applicableTypes = new Set([TokenType.Variable]);
      const result = createNamespacedCompletions(
        completionIndex,
        50,
        applicableTypes,
        "ns.",
        "xy",
        0,
      );

      expect(result.options).toHaveLength(1);
      expect(result.options[0]).toEqual({
        label: "ns.xyz",
        apply: "xyz",
        type: TokenType.Variable,
      });
    });

    test("respects the position cutoff (endPosition must be < position)", () => {
      const applicableTypes = new Set([TokenType.Variable]);
      const result = createNamespacedCompletions(
        completionIndex,
        10,
        applicableTypes,
        "ns.",
        "",
        0,
      );

      // "x" ends at 10, and ASTCompletionIndex.getTokensUpTo uses endPosition < position.
      expect(result.options).toEqual([]);
    });
  });

  describe("getEndNamespace", () => {
    test("returns completion index of target namespace", () => {
      const result = getEndNamespace(completionIndex, ["math"], 101);
      expect(result).toBe(namespaces[0].completionIndex);
    });

    test("returns null for non-existent namespace", () => {
      const result = getEndNamespace(completionIndex, ["nonexistent"], 60);
      expect(result).toBeNull();
    });

    test("returns null when namespace is defined after position", () => {
      const result = getEndNamespace(completionIndex, ["math"], 40);
      expect(result).toBeNull();
    });

    test("handles nested namespace path", () => {
      // Setup nested namespace in math namespace
      const trigCompletionIndex = new ASTCompletionIndex([
        { type: TokenType.Variable, value: "sin", endPosition: 85 },
      ]);

      const mathWithNested = new ASTCompletionIndex(
        [],
        [],
        [
          {
            name: "trig",
            completionIndex: trigCompletionIndex,
            startPosition: 80,
            endPosition: 90,
          },
        ],
      );

      const rootWithNested = new ASTCompletionIndex(
        [],
        [],
        [
          {
            name: "math",
            completionIndex: mathWithNested,
            startPosition: 50,
            endPosition: 100,
          },
        ],
      );

      const result = getEndNamespace(rootWithNested, ["math", "trig"], 101);
      expect(result).toBe(trigCompletionIndex);
    });

    test("selects the most recent namespace definition before the position", () => {
      const firstMathIndex = new ASTCompletionIndex([
        { type: TokenType.Variable, value: "old", endPosition: 10 },
      ]);
      const secondMathIndex = new ASTCompletionIndex([
        { type: TokenType.Variable, value: "new", endPosition: 10 },
      ]);

      const root = new ASTCompletionIndex(
        [],
        [],
        [
          {
            name: "math",
            completionIndex: firstMathIndex,
            startPosition: 0,
            endPosition: 50,
          },
          {
            name: "math",
            completionIndex: secondMathIndex,
            startPosition: 60,
            endPosition: 120,
          },
        ],
      );

      expect(getEndNamespace(root, ["math"], 100)).toBe(firstMathIndex);
      expect(getEndNamespace(root, ["math"], 150)).toBe(secondMathIndex);
    });

    test("returns null when position equals namespace endPosition", () => {
      const nsIndex = new ASTCompletionIndex();
      const root = new ASTCompletionIndex(
        [],
        [],
        [
          {
            name: "math",
            completionIndex: nsIndex,
            startPosition: 0,
            endPosition: 100,
          },
        ],
      );

      // getEndNamespace requires ns.endPosition < position
      expect(getEndNamespace(root, ["math"], 100)).toBeNull();
    });
  });

  describe("resolveEndNamespace", () => {
    test("resolves namespace from nested completion index chain", () => {
      // Mock getNestedCompletionIndexChainAt
      const mockIndex = cloneWithOverrides(completionIndex, {
        getNestedCompletionIndexChainAt: () => [completionIndex],
      });

      const result = resolveEndNamespace(mockIndex, ["math"], 101);
      expect(result).toBe(namespaces[0].completionIndex);
    });

    test("returns null when namespace not found in chain", () => {
      const mockIndex = cloneWithOverrides(completionIndex, {
        getNestedCompletionIndexChainAt: () => [completionIndex],
      });

      const result = resolveEndNamespace(mockIndex, ["nonexistent"], 60);
      expect(result).toBeNull();
    });

    test("prefers the innermost completion index in the nested chain", () => {
      const outerMathIndex = new ASTCompletionIndex([
        { type: TokenType.Variable, value: "outer", endPosition: 10 },
      ]);
      const innerMathIndex = new ASTCompletionIndex([
        { type: TokenType.Variable, value: "inner", endPosition: 10 },
      ]);

      const outer = new ASTCompletionIndex(
        [],
        [],
        [
          {
            name: "math",
            completionIndex: outerMathIndex,
            startPosition: 0,
            endPosition: 100,
          },
        ],
      );
      const inner = new ASTCompletionIndex(
        [],
        [],
        [
          {
            name: "math",
            completionIndex: innerMathIndex,
            startPosition: 0,
            endPosition: 100,
          },
        ],
      );

      const mockIndex = cloneWithOverrides(completionIndex, {
        getNestedCompletionIndexChainAt: () => [outer, inner],
      });

      expect(resolveEndNamespace(mockIndex, ["math"], 150)).toBe(
        innerMathIndex,
      );
    });
  });

  describe("createOpeningQualifiedVariableCompletionSource", () => {
    let source: CompletionSource;

    beforeEach(() => {
      source = createOpeningQualifiedVariableCompletionSource(completionIndex);
    });

    test("completes qualified variables after opening parenthesis", async () => {
      const context = createMockContext(120, "func(math.s");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(119); // 120 - 1 ("s")
      expect(result!.options).toContainEqual({
        label: "math.sin",
        apply: "sin",
        type: TokenType.Variable,
      });
    });

    test("handles qualified names after comma", async () => {
      const context = createMockContext(120, "func(a, math.co");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.options).toContainEqual({
        label: "math.cos",
        apply: "cos",
        type: TokenType.Variable,
      });
    });

    test("returns completions when qualified name ends with a dot", async () => {
      const context = createMockContext(120, "func(math.");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.from).toBe(120);
      expect(result!.options).toHaveLength(3);
      expect(result!.options).toContainEqual({
        label: "math.sin",
        apply: "sin",
        type: TokenType.Variable,
      });
      expect(result!.options).toContainEqual({
        label: "math.cos",
        apply: "cos",
        type: TokenType.Variable,
      });
      expect(result!.options).toContainEqual({
        label: "math.trig",
        apply: "trig",
        type: TokenType.Namespace,
      });
    });

    test("returns null for unqualified names", async () => {
      const context = createMockContext(10, "func(x");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });

    test("returns null when namespace cannot be resolved", async () => {
      const context = createMockContext(120, "func(unknown.s");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });
  });

  describe("createQualifiedVariableCompletionSource", () => {
    let source: CompletionSource;

    beforeEach(() => {
      const mockIndex = cloneWithOverrides(completionIndex, {
        getContextScenarioAt: (pos: number) =>
          pos >= 120 && pos <= 140
            ? { type: ContextScenarioType.ValueName, from: 120, to: 140 }
            : null,
        getNestedCompletionIndexChainAt: () => [completionIndex],
      });

      source = createQualifiedVariableCompletionSource(mockIndex);
    });

    test("completes qualified variables in ValueName context", async () => {
      const context = createMockContext(130, "math.si");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.options).toContainEqual({
        label: "math.sin",
        apply: "sin",
        type: TokenType.Variable,
      });
    });

    test("returns completions when qualified name ends with a dot", async () => {
      const context = createMockContext(130, "math.");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      // createQualifiedVariableCompletionSource uses match.to - partialVariable.length
      expect(result!.from).toBe(130); // 130 - 0 ("")
      expect(result!.options).toContainEqual({
        label: "math.cos",
        apply: "cos",
        type: TokenType.Variable,
      });
    });

    test("returns null when not in ValueName context", async () => {
      const context = createMockContext(30, "math.si");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });

    test("returns null for unqualified names", async () => {
      const context = createMockContext(130, "sin");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });

    test("returns null when namespace cannot be resolved", async () => {
      const context = createMockContext(130, "unknown.si");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });
  });

  describe("createOpeningQualifiedStyleCompletionSource", () => {
    let source: CompletionSource;
    let indexWithStyles: ASTCompletionIndex;

    beforeEach(() => {
      // Create a namespace with style tags
      const styleNamespace = new ASTCompletionIndex([
        { type: TokenType.StyleTag, value: "red", endPosition: 70 },
        { type: TokenType.StyleTag, value: "blue", endPosition: 75 },
      ]);

      indexWithStyles = new ASTCompletionIndex(tokenInfo, contextScenarios, [
        {
          name: "colors",
          completionIndex: styleNamespace,
          startPosition: 50,
          endPosition: 100,
        },
      ]);
      source = createOpeningQualifiedStyleCompletionSource(indexWithStyles);
    });

    test("completes qualified style tags in curly braces", async () => {
      const context = createMockContext(120, "{#colors.re");
      const result = await runSource(source, context);
      expect(result).toBeTruthy();
      expect(result!.options).toHaveLength(1);
      expect(result!.options[0]).toEqual({
        label: "colors.red",
        apply: "red",
        type: TokenType.StyleTag,
      });
    });

    test("returns null for unqualified style names", async () => {
      const context = createMockContext(10, "{#red");
      const result = await runSource(source, context);
      expect(result).toBeNull(); // No dot, so not qualified
    });

    test("returns completions when qualified style ends with a dot", async () => {
      const context = createMockContext(120, "{#colors.");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.options).toHaveLength(2);
      expect(result!.options).toContainEqual({
        label: "colors.red",
        apply: "red",
        type: TokenType.StyleTag,
      });
      expect(result!.options).toContainEqual({
        label: "colors.blue",
        apply: "blue",
        type: TokenType.StyleTag,
      });
    });

    test("returns null when style namespace cannot be resolved", async () => {
      const context = createMockContext(120, "{#unknown.re");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });
  });

  describe("createQualifiedStyleCompletionSource", () => {
    let source: CompletionSource;

    beforeEach(() => {
      // Create a namespace with style tags
      const styleNamespace = new ASTCompletionIndex([
        { type: TokenType.StyleTag, value: "red", endPosition: 70 },
        { type: TokenType.StyleTag, value: "blue", endPosition: 75 },
      ]);

      const mockIndex = cloneWithOverrides(completionIndex, {
        getContextScenarioAt: (pos: number) =>
          pos >= 150 && pos <= 170
            ? { type: ContextScenarioType.StyleArgList, from: 150, to: 170 }
            : null,
        namespaces: [
          {
            name: "colors",
            completionIndex: styleNamespace,
            startPosition: 50,
            endPosition: 100,
          },
        ],
        getNestedCompletionIndexChainAt: (): ASTCompletionIndex[] => [
          mockIndex,
        ],
      });

      source = createQualifiedStyleCompletionSource(mockIndex);
    });

    test("completes qualified style tags in StyleArgList context", async () => {
      const context = createMockContext(160, "#colors.re");
      const result = await runSource(source, context);
      expect(result).toBeTruthy();
      // Should find "red" in colors namespace
      expect(result!.options).toHaveLength(1);
      expect(result!.options[0]).toEqual({
        label: "colors.red",
        apply: "red",
        type: TokenType.StyleTag,
      });
    });

    test("returns null when not in StyleArgList context", async () => {
      const context = createMockContext(30, "#colors.re");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });

    test("returns null for unqualified style names", async () => {
      const context = createMockContext(160, "#red");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });

    test("returns completions when qualified style ends with a dot", async () => {
      const context = createMockContext(160, "#colors.");
      const result = await runSource(source, context);

      expect(result).toBeTruthy();
      expect(result!.options).toHaveLength(2);
      expect(result!.options).toContainEqual({
        label: "colors.red",
        apply: "red",
        type: TokenType.StyleTag,
      });
      expect(result!.options).toContainEqual({
        label: "colors.blue",
        apply: "blue",
        type: TokenType.StyleTag,
      });
    });

    test("returns null when style namespace cannot be resolved", async () => {
      const context = createMockContext(160, "#unknown.re");
      const result = await runSource(source, context);
      expect(result).toBeNull();
    });

    test("returns null when not in StyleArgList context", () => {
      const context = createMockContext(30, "#colors.re");
      const result = source(context);
      expect(result).toBeNull();
    });

    test("returns null for unqualified style names", () => {
      const context = createMockContext(160, "#red");
      const result = source(context);
      expect(result).toBeNull();
    });
  });

  describe("getAllDynamicCompletionSources", () => {
    test("all sources handle null context gracefully", () => {
      const sources = getAllDynamicCompletionSources(completionIndex);
      const nullContext = createMockContext(0, "");

      sources.forEach((source) => {
        // Should not throw
        expect(() => source(nullContext)).not.toThrow();
      });
    });
  });

  describe("integration tests", () => {
    test("statement completion works for simple keyword start", async () => {
      const source = createStatementCompletionSource(completionIndex);
      const context = createMockContext(40, "mix");
      const result = await runSource(source, context);
      expect(result).toBeTruthy();
      expect(result!.options).toContainEqual({
        label: "mix",
        type: TokenType.Keyword,
      });
    });

    test("statement completion works after semicolon", async () => {
      const source = createStatementCompletionSource(completionIndex);
      const context = createMockContext(40, "x = 1; im");
      const result = await runSource(source, context);
      expect(result).toBeTruthy();
      expect(result!.options).toContainEqual({
        label: "import",
        type: TokenType.Keyword,
      });
    });

    test("statement completion works with indentation and newlines", async () => {
      const source = createStatementCompletionSource(completionIndex);
      const context = createMockContext(40, "\n  mix");
      const result = await runSource(source, context);
      expect(result).toBeTruthy();
      expect(result!.options).toContainEqual({
        label: "mix",
        type: TokenType.Keyword,
      });
    });

    test("variable completion works in call contexts", async () => {
      const mockIndex = cloneWithOverrides(completionIndex, {
        getContextScenarioAt: () => ({
          type: ContextScenarioType.ValueName,
          from: 0,
          to: 100,
        }),
      });

      const callSource = createCallCompletionSource(mockIndex);
      const fallbackSource = createCallCompletionSource(completionIndex);

      const callContext = createMockContext(65, "x");
      const openingContext = createMockContext(40, "func(x");

      const callResult = await runSource(callSource, callContext);
      const openingResult = await runSource(fallbackSource, openingContext);

      expect(callResult).toBeTruthy();
      expect(callResult!.options).toContainEqual({
        label: "x",
        type: TokenType.Variable,
      });
      expect(openingResult).toBeTruthy();
      expect(openingResult!.options).toContainEqual({
        label: "x",
        type: TokenType.Variable,
      });
    });

    test("style completion works in style contexts", async () => {
      const mockIndex = cloneWithOverrides(completionIndex, {
        getContextScenarioAt: () => ({
          type: ContextScenarioType.StyleArgList,
          from: 0,
          to: 100,
        }),
      });

      const styleSource = createStyleCompletionSource(mockIndex);
      const fallbackSource = createStyleCompletionSource(completionIndex);

      const styleContext = createMockContext(95, "#bold");
      const openingContext = createMockContext(60, "{#bold");

      const styleResult = await runSource(styleSource, styleContext);
      const openingResult = await runSource(fallbackSource, openingContext);

      expect(styleResult).toBeTruthy();
      expect(styleResult!.options).toContainEqual({
        label: "bold",
        type: TokenType.StyleTag,
      });
      expect(openingResult).toBeTruthy();
      expect(openingResult!.options).toContainEqual({
        label: "bold",
        type: TokenType.StyleTag,
      });
    });
  });
});
