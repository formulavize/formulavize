import { VersionedStore } from "./versionedStore";

export type ThemeMode = "light" | "dark" | "system";

export interface Options {
  enableTabbingInEditor: boolean;
  debugMode: boolean;
  themeMode?: ThemeMode;
}

const DEFAULTS: Options = {
  enableTabbingInEditor: false, // off by default to avoid focus trapping
  debugMode: false,
};

export class OptionsStore extends VersionedStore<Options> {
  constructor() {
    super("formulavize-options", 2, DEFAULTS);
  }
}
