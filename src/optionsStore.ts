import { VersionedStore } from "./versionedStore";

export interface Options {
  tabToIndent: boolean;
  debugMode: boolean;
  selectedRenderer: string;
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
