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
import namedColors from "colors-named";
import namedColorHexes from "colors-named-hex";

// Swatch pickers for colors written in a fiz recipe.
//
// A style declaration can name a color three ways: a bare hex literal
// (`background-color: #ff0000`), a quoted hex (`"#ff0000"`), and a quoted
// name (`"lightblue"`). lezer-fiz emits the first as a ColorLiteral and the
// other two as a StringLiteral, but both sit in its StyleValue group, so one
// pass over a declaration's values covers every form. A pick is written back
// in the form the recipe used, keeping its quoting and any alpha it carried.

/** A style value that names a color, and where it sits in the doc. */
export interface StyleColor {
  /** Document offset where the value starts (the opening quote, if quoted). */
  from: number;
  /** Document offset just past the end of the value. */
  to: number;
  /** The color as `#rrggbb`, the only form an `<input type="color">` takes. */
  hex: string;
  /**
   * Hex alpha digits the recipe wrote, or "" when it wrote none. The picker
   * cannot edit alpha, so it is carried through a change untouched.
   */
  alpha: string;
  /** The quote character the recipe used, or "" for a bare hex literal. */
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

/** Resolve a style value to a picker-ready color, or null if it names none. */
function parseColor(value: string): { hex: string; alpha: string } | null {
  if (HEX_PATTERN.test(value)) {
    // A 3- or 4-digit hex abbreviates each channel to one digit; expanding it
    // first leaves the rgb and alpha digits at fixed offsets either way.
    const digits = value.slice(1).toLowerCase();
    const expanded =
      digits.length <= 4
        ? [...digits].map((digit) => digit + digit).join("")
        : digits;
    return { hex: `#${expanded.slice(0, 6)}`, alpha: expanded.slice(6) };
  }
  const named = COLOR_NAME_TO_HEX_MAP.get(value.toLowerCase());
  return named ? { hex: named, alpha: "" } : null;
}

const QUOTES = ['"', "'"];

/**
 * Find the colors among the style declarations in a document range.
 *
 * A declaration may list several values (`background-color: "red", "blue"`), so
 * every value is considered. A value that is not a single color (e.g. a
 * gradient's `"red blue"` stop list, or a number) yields no swatch.
 */
export function findStyleColors(
  state: EditorState,
  from: number,
  to: number,
): StyleColor[] {
  const found: StyleColor[] = [];
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
      for (const value of declaration.getChildren("StyleValue")) {
        const raw = state.doc.sliceString(value.from, value.to);
        const quote = QUOTES.includes(raw[0]) ? raw[0] : "";
        const parsed = parseColor(quote ? raw.slice(1, -1).trim() : raw);
        if (!parsed) continue;
        found.push({
          from: value.from,
          to: value.to,
          hex: parsed.hex,
          alpha: parsed.alpha,
          quote,
        });
      }
    },
  });
  return found;
}

/** The text a picked color should replace the original style value with. */
export function rewriteStyleColor(target: StyleColor, picked: string): string {
  return `${target.quote}${picked.toLowerCase()}${target.alpha}${target.quote}`;
}

// Which document range each live picker stands for, kept off the element so it
// stays typed and is dropped along with the element it belongs to.
const pickerTargets = new WeakMap<HTMLInputElement, StyleColor>();

class StyleColorWidget extends WidgetType {
  constructor(private readonly target: StyleColor) {
    super();
  }

  // from/to take part although the DOM does not show them: an unequal widget
  // is what makes codemirror call toDOM again, and only that refreshes the
  // pickerTargets entry a later pick reads its range from.
  eq(other: StyleColorWidget): boolean {
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
    // `data-color` on the wrapper is what the swatch theme below selects on.
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

function styleColorDecorations(view: EditorView): DecorationSet {
  const widgets: Range<Decoration>[] = [];
  for (const range of view.visibleRanges) {
    for (const target of findStyleColors(view.state, range.from, range.to)) {
      const widget = Decoration.widget({
        widget: new StyleColorWidget(target),
      });
      widgets.push(widget.range(target.from));
    }
  }
  return Decoration.set(widgets);
}

const styleColorView = ViewPlugin.fromClass(
  class StyleColorView {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = styleColorDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = styleColorDecorations(update.view);
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
            insert: rewriteStyleColor(target, picker.value),
          },
        });
        return true;
      },
    },
  },
);

// A small square showing the color, with the platform picker stretched off to
// one side so only the square shows. Adapted from the theme that shipped with
// `@uiw/codemirror-extensions-color`, which this file used to lean on for the
// bare hex case.
const swatchTheme = EditorView.baseTheme({
  "span[data-color]": {
    width: "12px",
    height: "12px",
    display: "inline-block",
    borderRadius: "2px",
    marginRight: "0.5ch",
    marginTop: "-2px",
    outline: "1px solid #00000040",
    overflow: "hidden",
    verticalAlign: "middle",
  },
  'span[data-color] input[type="color"]': {
    background: "transparent",
    border: "none",
    display: "block",
    height: "12px",
    outline: "0",
    paddingLeft: "24px",
  },
  'span[data-color] input[type="color"]::-webkit-color-swatch': {
    border: "none",
    paddingLeft: "24px",
  },
  // A `#00000040` outline all but disappears against the dark editor theme, so
  // lighten it there to keep a dark swatch reading as a swatch.
  "&dark span[data-color]": {
    outline: "1px solid #ffffff40",
  },
});

/**
 * Inline color swatches for every way a fiz style declaration can name a
 * color: bare (`#ff0000`), quoted hex (`"#ff0000"`) and quoted name
 * (`"lightblue"`). Clicking a swatch opens the platform picker and writes the
 * choice back in place, preserving the original quoting and any alpha the
 * value carried.
 */
export const colorPicker: Extension = [styleColorView, swatchTheme];
