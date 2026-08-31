import { Component } from "vue";
import { Dag } from "../compiler/dag";
import { ExportFormat } from "./exportFormat";

/**
 * Options for exporting a file from a renderer.
 */
export interface FileExportOptions {
  fileName: string;
  fileType: ExportFormat;
  scalingFactor: number;
  // Background fill for the exported image. When omitted, the underlying
  // exporter's default applies (transparent for png/svg, white for jpg).
  backgroundColor?: string;
}

/**
 * Options for rendering a dag to bytes outside a browser.
 *
 * Deliberately not a FileExportOptions: a headless render returns bytes for the
 * caller to place, so it has no file name, and the background comes from the
 * dag's own directive rather than from the caller.
 */
export interface HeadlessRenderOptions {
  fileType: ExportFormat;
  scalingFactor: number;
  isDark: boolean;
  includeDescriptions: boolean;
}

/**
 * Interface that all renderer components must implement.
 * This allows GraphView to work with any renderer implementation.
 */
export interface IRenderer {
  /**
   * Update the visualization with a new DAG.
   * @param dag The DAG to visualize
   */
  updateDag(dag: Dag): void;

  /**
   * Export the current visualization as a file.
   * @param options Export configuration options
   */
  export(options: FileExportOptions): void;
}

/**
 * Props that every renderer component accepts.
 */
export interface RendererProps {
  dag: Dag;
  isDark: boolean;
}

/**
 * A renderer's drawing component. Metadata lives on the RendererPlugin that
 * carries the component, keeping the component focused purely on rendering.
 */
export type RendererComponent = Component<RendererProps>;

/**
 * One property a renderer understands, described without reference to any
 * editor library so a renderer never has to depend on CodeMirror.
 */
export interface PropertyCompletion {
  name: string;
  // Short hint shown beside the name in the completion list.
  detail?: string;
  // Longer documentation shown when the completion is highlighted.
  info?: string;
}

/**
 * The vocabulary a renderer offers the editor's autocomplete.
 */
export interface RendererCompletions {
  /**
   * Style properties offered inside a style block. `elementType` is the
   * canonical keyword ("node", "edge", or "subgraph") when the block is a
   * global style binding, and undefined for a plain style block or tag body.
   */
  styleProperties(elementType?: string): PropertyCompletion[];

  /**
   * Properties offered inside this renderer's '^<name>{ }' directive block.
   * `declared` holds the key/value pairs the block already declares, letting a
   * renderer narrow what it offers based on them.
   */
  directiveProperties(
    declared: ReadonlyMap<string, string>,
  ): PropertyCompletion[];
}

/**
 * A renderer definition, independent of how it draws.
 *
 * Everything here is plain data or pure functions, so a node-side entry point
 * can describe a renderer without loading the browser component that draws it.
 */
export interface RendererDescriptor {
  /** Identifier used in a '^<name>{ }' directive and as the registry key. */
  readonly name: string;
  readonly displayName: string;
  readonly supportedExportFormats: readonly ExportFormat[];
  /** Omit to offer no property completions for this renderer. */
  readonly completions?: RendererCompletions;
  /** Node-side export used by the CLI. Omit for browser-only renderers. */
  renderHeadless?(
    dag: Dag,
    options: HeadlessRenderOptions,
  ): Promise<Uint8Array>;
}

/**
 * Everything the app needs to know about a renderer.
 *
 * Registering a renderer means handing a plugin to a RendererRegistry; nothing
 * else in the app needs to learn the renderer's name or reach into its module.
 */
export interface RendererPlugin extends RendererDescriptor {
  readonly component: RendererComponent;
}
