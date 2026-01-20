import { Component } from "vue";
import { Dag } from "../compiler/dag";
import { ImageExportFormat } from "../compiler/constants";

/**
 * Options for exporting an image from a renderer.
 */
export interface ImageExportOptions {
  fileName: string;
  fileType: ImageExportFormat;
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
   * Export the current visualization as an image.
   * @param options Export configuration options
   */
  exportImage(options: ImageExportOptions): void;
}

/**
 * Props that every renderer component should accept.
 */
export interface RendererProps {
  dag: Dag;
}

/**
 * Type for renderer component constructors.
 */
export type RendererComponent = Component;
