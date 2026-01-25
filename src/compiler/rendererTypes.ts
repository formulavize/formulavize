import { Component } from "vue";
import { Dag } from "./dag";
import { ExportFormat } from "./constants";

/**
 * Options for exporting a file from a renderer.
 */
export interface FileExportOptions {
  fileName: string;
  fileType: ExportFormat;
  scalingFactor: number;
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
 * Props that every renderer component should accept.
 */
export interface RendererProps {
  dag: Dag;
}

/**
 * Type for renderer component constructors.
 * All renderer components must have
 * static displayName and supportedExportFormats properties.
 */
export type RendererComponent = Component<RendererProps> & {
  readonly displayName: string;
  readonly supportedExportFormats: readonly ExportFormat[];
};
