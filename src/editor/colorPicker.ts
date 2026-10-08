import { syntaxTree } from "@codemirror/language";
import { EditorState, Extension, Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { color as colorLiteralPicker } from "@uiw/codemirror-extensions-color";
import namedColors from "colors-named";
import namedColorHexes from "colors-named-hex";

// Swatch pickers for colors written in a fiz recipe.
//
// `@uiw/codemirror-extensions-color` keys off the syntax node name
// `ColorLiteral`, which lezer-fiz emits for a bare hex value, so it covers
// `background-color: #ff0000` as shipped. It does not cover the quoted form
// (`background-color: "lightblue"`), which lezer-fiz emits as a StringLiteral
// and which recipes use at least as often, so the quoted case gets a sibling
// plugin here. The two never see the same node, and both draw the swatch DOM
// that the upstream `colorTheme` (bundled into its `color` extension) styles.

/** A quoted style value that names a color, and where it sits in the doc. */
export interface QuotedColor {
  /** Document offset of the opening quote. */
  from: number;
  /** Document offset just past the closing quote. */
  to: number;
  /** The color as `#rrggbb`, the only form an `<input type="color">` takes. */
  hex: string;
  /**
   * Hex alpha digits the recipe wrote, or "" when it wrote none. The picker
   * cannot edit alpha, so it is carried through a change untouched.
   */
  alpha: string;
  /** The quote character the recipe used, preserved when rewriting. */
  quote: string;
}

const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const COLOR_NAME_TO_HEX_MAP: ReadonlyMap<string, string> = new Map(
  namedColors.map(
    (name, index) => [name, namedColorHexes[index].toLowerCase()] as const,
  ),
);

/**
 * Whether a style property holds a color.
 *
 * Name-based rather than asked of the active renderer: a `-color` suffix is a
 * CSS-wide convention, so this stays renderer-neutral. It deliberately excludes
 * cytoscape's `-fill` properties, which name a fill style ("solid",
 * "linear-gradient") rather than a color.
 */
function isColorProperty(propertyName: string): boolean {
  return (
    propertyName === "color" ||
    propertyName.endsWith("-color") ||
    propertyName.endsWith("-colors")
  );
}

/** Expand a 3/4/6/8-digit hex to the `#rrggbb` plus alpha digits pair. */
function splitHex(hex: string): { rgb: string; alpha: string } {
  const digits = hex.slice(1).toLowerCase();
  const perChannel = digits.length <= 4 ? 1 : 2;
  const channel = (index: number): string => {
    const raw = digits.slice(index * perChannel, (index + 1) * perChannel);
    return perChannel === 1 ? raw + raw : raw;
  };
  return {
    rgb: `#${channel(0)}${channel(1)}${channel(2)}`,
    alpha: channel(3),
  };
}

/** Resolve a style value to a picker-ready color, or null if it names none. */
function parseColor(value: string): { hex: string; alpha: string } | null {
  if (HEX_PATTERN.test(value)) {
    const { rgb, alpha } = splitHex(value);
    return { hex: rgb, alpha };
  }
  const hex = COLOR_NAME_TO_HEX_MAP.get(value.toLowerCase());
  if (!hex) return null;
  return { hex, alpha: "" };
}

/**
 * Find the quoted colors among the style declarations in a document range.
 *
 * A declaration may list several values (`background-color: "red", "blue"`), so
 * every string child is considered. A value that is not a single color (e.g. a
 * gradient's `"red blue"` stop list) yields no swatch.
 */
export function findQuotedColors(
  state: EditorState,
  from: number,
  to: number,
): QuotedColor[] {
  const found: QuotedColor[] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter: (nodeRef) => {
      if (nodeRef.name !== "StyleDeclaration") return;
      const declaration = nodeRef.node;
      const property = declaration.getChild("PropertyName");
      if (!property) return;
      const propertyName = state.doc.sliceString(property.from, property.to);
      if (!isColorProperty(propertyName)) return;
      for (const literal of declaration.getChildren("StringLiteral")) {
        const raw = state.doc.sliceString(literal.from, literal.to);
        if (raw.length < 2) continue;
        const parsed = parseColor(raw.slice(1, -1).trim());
        if (!parsed) continue;
        found.push({
          from: literal.from,
          to: literal.to,
          hex: parsed.hex,
          alpha: parsed.alpha,
          quote: raw[0],
        });
      }
    },
  });
  return found;
}

/** The text a picked color should replace the original quoted value with. */
export function rewriteQuotedColor(
  target: QuotedColor,
  picked: string,
): string {
  return `${target.quote}${picked.toLowerCase()}${target.alpha}${target.quote}`;
}

// Which document range each live picker stands for. Kept off the element so the
// upstream plugin's change handler, which looks for its own `data-color` on the
// input, declines our swatches and we decline its.
const pickerTargets = new WeakMap<HTMLInputElement, QuotedColor>();

class QuotedColorWidget extends WidgetType {
  constructor(private readonly target: QuotedColor) {
    super();
  }

  eq(other: QuotedColorWidget): boolean {
    return (
      other.target.from === this.target.from &&
      other.target.to === this.target.to &&
      other.target.hex === this.target.hex &&
      other.target.alpha === this.target.alpha
    );
  }

  toDOM(): HTMLElement {
    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = this.target.hex;
    pickerTargets.set(picker, this.target);
    // `data-color` on the wrapper is what the upstream swatch theme selects on.
    const wrapper = document.createElement("span");
    wrapper.dataset.color = this.target.hex;
    wrapper.style.backgroundColor = this.target.hex;
    wrapper.appendChild(picker);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function quotedColorDecorations(view: EditorView): DecorationSet {
  const widgets: Range<Decoration>[] = [];
  for (const range of view.visibleRanges) {
    for (const target of findQuotedColors(view.state, range.from, range.to)) {
      const widget = Decoration.widget({
        widget: new QuotedColorWidget(target),
      });
      widgets.push(widget.range(target.from));
    }
  }
  return Decoration.set(widgets);
}

const quotedColorView = ViewPlugin.fromClass(
  class QuotedColorView {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = quotedColorDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = quotedColorDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      change: (event, view) => {
        const picker = event.target as HTMLInputElement;
        const target = pickerTargets.get(picker);
        if (!target) return false;
        view.dispatch({
          changes: {
            from: target.from,
            to: target.to,
            insert: rewriteQuotedColor(target, picker.value),
          },
        });
        return true;
      },
    },
  },
);

// The upstream swatch theme outlines each swatch in `#00000040`, which all but
// disappears against the dark editor theme. Lighten it there so a dark swatch
// still reads as a swatch.
const darkSwatchOutline = EditorView.baseTheme({
  "&dark span[data-color]": {
    outline: "1px solid #ffffff40",
  },
});

/**
 * Inline color swatches for both the bare (`#ff0000`) and quoted
 * (`"lightblue"`) ways a fiz style declaration can name a color. Clicking a
 * swatch opens the platform picker and writes the choice back in place,
 * preserving the original quoting and any alpha the value carried.
 */
export const colorPicker: Extension = [
  colorLiteralPicker,
  quotedColorView,
  darkSwatchOutline,
];
