import { VersionedStore } from "./versionedStore";

export type ThemeMode = "light" | "dark" | "system";

export interface Options {
  enableTabbingInEditor: boolean;
  debugMode: boolean;
  selectedRenderer: string;
  themeMode?: ThemeMode;
}

const DEFAULTS: Options = {
  enableTabbingInEditor: false, // off by default to avoid focus trapping
  debugMode: false,
  selectedRenderer: "cytoscape",
};

export class OptionsStore extends VersionedStore<Options> {
  constructor() {
    super("formulavize-options", 1, DEFAULTS);
  }
}
