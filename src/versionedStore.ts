export class VersionedStore<T> {
  constructor(
    private readonly storageKey: string,
    private readonly version: number,
    private readonly defaults: T,
  ) {}

  load(): T {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return this.defaults;
      const parsed = JSON.parse(raw) as { version: number } & T;
      if (parsed.version !== this.version) return this.defaults;
      const { version: _version, ...rest } = parsed;
      return rest as T;
    } catch {
      return this.defaults;
    }
  }

  save(data: T): void {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({ version: this.version, ...data }),
      );
    } catch {
      console.warn(`Unable to save to localStorage key "${this.storageKey}"`);
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      console.warn(`Unable to clear localStorage key "${this.storageKey}"`);
    }
  }
}
