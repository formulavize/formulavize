import { JSDOM } from "jsdom";
import { createCanvas, GlobalFonts, type Canvas } from "@napi-rs/canvas";
import { Dag } from "../compiler/dag";
import { ExportFormat } from "../compiler/constants";
import { makeCyElements } from "../renderers/cyDag/cyGraphFactory";
import { makeCyStylesheets } from "../renderers/cyDag/cyStyleSheetsFactory";
import { getCanvasBackgroundColor } from "../renderers/cyDag/cyRendererDirectives";
import { makeDagreLayoutOptions } from "../renderers/cyDag/cyLayout";
import { exportCyToBlob } from "../renderers/cyDag/cyExport";
import { addDescriptionGhostNodes } from "../renderers/cyDag/cyPopperExtender";

const CONTAINER_WIDTH = 1024;
const CONTAINER_HEIGHT = 768;

function setGlobal(key: string, value: unknown): void {
  try {
    (globalThis as unknown as Record<string, unknown>)[key] = value;
  } catch {
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
}

function getRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

/**
 * Cytoscape's canvas renderer needs a canvas 2D context (used for text/label
 * measurement) even when exporting to SVG. jsdom does not implement <canvas>
 * unless the `canvas` package is present, so we back jsdom's HTMLCanvasElement
 * with @napi-rs/canvas (prebuilt Skia binaries, no system libraries). The DOM
 * element stays a real jsdom node (so appendChild/style/events work) while all
 * drawing, text metrics, and rasterization are delegated to a Skia canvas.
 */
function installCanvasShim(window: Window & typeof globalThis): void {
  // Ensure real font metrics are available for text measurement. napi-rs loads
  // system fonts lazily; nudging it is best-effort and typing-version dependent.
  const fonts = GlobalFonts as unknown as { loadSystemFonts?: () => void };
  try {
    fonts.loadSystemFonts?.();
  } catch {
    // Ignore; napi-rs falls back to bundled/system fonts on most platforms.
  }

  const proto = window.HTMLCanvasElement.prototype as unknown as {
    getContext: unknown;
    toDataURL: unknown;
    toBlob: unknown;
  };
  const backing = new WeakMap<object, Canvas>();
  const dims = new WeakMap<object, { w: number; h: number }>();

  const getDims = (el: object) => dims.get(el) ?? { w: 300, h: 150 };
  const ensure = (el: object): Canvas => {
    let canvas = backing.get(el);
    if (!canvas) {
      const { w, h } = getDims(el);
      canvas = createCanvas(w, h) as Canvas;
      backing.set(el, canvas);
    }
    return canvas;
  };

  const defineSize = (name: "width" | "height", key: "w" | "h") => {
    Object.defineProperty(window.HTMLCanvasElement.prototype, name, {
      configurable: true,
      get(this: object) {
        return getDims(this)[key];
      },
      set(this: object, value: number) {
        const next = { ...getDims(this), [key]: value };
        dims.set(this, next);
        const canvas = backing.get(this);
        if (canvas) canvas[name] = value;
      },
    });
  };
  defineSize("width", "w");
  defineSize("height", "h");

  const mimeToNapi = (mime: string) =>
    mime === "image/jpeg" ? "image/jpeg" : "image/png";

  proto.getContext = function (this: object, type: string) {
    if (type !== "2d") return null;
    return ensure(this).getContext("2d");
  };
  proto.toDataURL = function (
    this: object,
    mime = "image/png",
    quality?: number,
  ) {
    // napi-rs typings are narrower than the DOM signature we emulate here.
    return (ensure(this).toDataURL as (m?: string, q?: number) => string)(
      mimeToNapi(mime),
      quality,
    );
  };
  proto.toBlob = function (
    this: object,
    callback: (blob: Blob | null) => void,
    mime = "image/png",
    quality?: number,
  ) {
    // Cytoscape's blob export path actually uses toDataURL; derive the blob from
    // it so we avoid @napi-rs/canvas's stricter toBuffer overloads.
    const dataUrl = (
      ensure(this).toDataURL as (m?: string, q?: number) => string
    )(mimeToNapi(mime), quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));
    callback(new Blob([bytes], { type: mime }));
  };
}

/**
 * Create a jsdom window with the globals Cytoscape's canvas renderer probes for
 * and install the canvas shim. Must run before Cytoscape is imported so the
 * library sees a live DOM.
 */
function installHeadlessDom(): Document {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    pretendToBeVisual: true,
  });
  const { window } = dom;
  installCanvasShim(window as unknown as Window & typeof globalThis);

  // Some globals (e.g. navigator) are read-only accessors in modern Node, so
  // assign defensively. Node already provides a usable navigator/Blob.
  const win = window as unknown as Record<string, unknown>;
  if (!("ResizeObserver" in win)) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    win.ResizeObserver = ResizeObserverStub;
  }

  setGlobal("window", window);
  setGlobal("document", window.document);
  setGlobal("Node", window.Node);
  setGlobal("Element", window.Element);
  setGlobal("HTMLElement", window.HTMLElement);
  setGlobal("HTMLCanvasElement", window.HTMLCanvasElement);
  setGlobal("Image", window.Image);
  setGlobal("XMLSerializer", window.XMLSerializer);
  setGlobal("getComputedStyle", window.getComputedStyle.bind(window));
  setGlobal("ResizeObserver", win.ResizeObserver);

  return window.document;
}

export interface HeadlessRenderOptions {
  fileType: ExportFormat;
  scalingFactor: number;
  isDark: boolean;
  includeDescriptions: boolean;
}

/**
 * Render a compiled Dag to image bytes headlessly (no browser).
 *
 * Reuses the exact same element/stylesheet factories, dagre layout options, and
 * export logic as the web renderer so CLI output matches the app.
 */
export async function renderDagToBytes(
  dag: Dag,
  options: HeadlessRenderOptions,
): Promise<Buffer> {
  const document = installHeadlessDom();

  // Dynamically import Cytoscape and its extensions AFTER the DOM globals are in
  // place; static imports would evaluate before the DOM exists.
  const cytoscape = (await import("cytoscape")).default;
  const dagre = (await import("cytoscape-dagre")).default;
  // @ts-expect-error: cytoscape-svg ships no types
  const svg = (await import("cytoscape-svg")).default;
  cytoscape.use(dagre);
  cytoscape.use(svg);

  const container = document.createElement("div");
  document.body.appendChild(container);
  Object.defineProperties(container, {
    clientWidth: { value: CONTAINER_WIDTH, configurable: true },
    clientHeight: { value: CONTAINER_HEIGHT, configurable: true },
  });
  container.getBoundingClientRect = () =>
    getRect(CONTAINER_WIDTH, CONTAINER_HEIGHT);

  const cy = cytoscape({
    container,
    elements: makeCyElements(dag),
    style: makeCyStylesheets(dag, options.isDark),
    // Skip the default grid layout at construction (it reads the viewport, which
    // is inert headless); we run dagre explicitly below.
    layout: { name: "preset" },
  });

  try {
    // Run the dagre layout and wait for it to settle before exporting.
    await new Promise<void>((resolve) => {
      cy.one("layoutstop", () => resolve());
      cy.layout(makeDagreLayoutOptions(dag)).run();
    });

    // Description text is captured by invisible ghost nodes, mirroring the app's
    // canvas-based export path (see CytoscapeRenderer.export).
    const ghostIds = options.includeDescriptions
      ? addDescriptionGhostNodes(cy, dag)
      : [];

    const blob = exportCyToBlob(cy, {
      fileName: "formulavize",
      fileType: options.fileType,
      scalingFactor: options.scalingFactor,
      backgroundColor: getCanvasBackgroundColor(dag),
    });

    for (const id of ghostIds) cy.getElementById(id).remove();

    if (!blob) {
      throw new Error(`Unsupported export format: ${options.fileType}`);
    }
    return Buffer.from(await blob.arrayBuffer());
  } finally {
    cy.destroy();
  }
}
