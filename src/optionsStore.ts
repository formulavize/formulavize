interface StoredOptions {
  version: number;
  tabToIndent: boolean;
  debugMode: boolean;
  selectedRenderer: string;
}

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

export class OptionsStore {
  private static readonly STORAGE_KEY = "formulavize-options";
  private static readonly VERSION = 1;

  load(): Options {
    try {
      const raw = localStorage.getItem(OptionsStore.STORAGE_KEY);
      if (!raw) return DEFAULTS;
      const parsed = JSON.parse(raw) as StoredOptions;
      if (parsed.version !== OptionsStore.VERSION) return DEFAULTS;
      return {
        tabToIndent: parsed.tabToIndent,
        debugMode: parsed.debugMode,
        selectedRenderer: parsed.selectedRenderer,
      };
    } catch {
      return DEFAULTS;
    }
  }

  save(options: Options): void {
    try {
      localStorage.setItem(
        OptionsStore.STORAGE_KEY,
        JSON.stringify({
          version: OptionsStore.VERSION,
          ...options,
        }),
      );
    } catch {
      console.warn("Unable to save options to localStorage");
    }
  }
}
