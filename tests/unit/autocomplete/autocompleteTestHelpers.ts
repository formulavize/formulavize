import { CompletionContext, CompletionSource } from "@codemirror/autocomplete";

// Mock CompletionContext for testing
export function createMockContext(
  pos: number,
  text: string,
  explicit: boolean = false,
): CompletionContext {
  return {
    pos,
    explicit,
    matchBefore: (pattern: RegExp) => {
      // In CodeMirror, `pos` is an absolute document position.
      // These tests often pass a short snippet that ends at the cursor,
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

export const runSource = (source: CompletionSource, ctx: CompletionContext) =>
  Promise.resolve()
    .then(() => source(ctx))
    .catch(() => null);
