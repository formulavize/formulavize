import { VersionedStore } from "./versionedStore";

export type ThemeMode = "light" | "dark" | "system";

export interface Options {
  tabToIndent: boolean;
  debugMode: boolean;
  selectedRenderer: string;
  themeMode?: ThemeMode;
}

const DEFAULTS: Options = {
  tabToIndent: false,
  debugMode: false,
  selectedRenderer: "cytoscape",
};

export class OptionsStore extends VersionedStore<Options> {
  constructor() {
    super("formulavize-options", 1, DEFAULTS);
  }
}
