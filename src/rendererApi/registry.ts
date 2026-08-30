import { Dag } from "../compiler/dag";
import { RendererDescriptor, RendererPlugin } from "./types";

/**
 * The set of renderers available to draw a dag.
 *
 * Deliberately free of any framework dependency so the editor and the CLI
 * resolve renderers the same way. The compiler does not validate the name in a
 * '^<name>{ }' directive against this registry, so a directive addressed to a
 * renderer that is not registered here is simply ignored.
 */
export class RendererRegistry<T extends RendererDescriptor = RendererPlugin> {
  private readonly plugins = new Map<string, T>();

  /**
   * @param plugins Renderers to register, in order.
   * @param defaultName Renderer used when a dag selects none. Defaults to the
   *   first plugin registered.
   */
  constructor(
    plugins: readonly T[] = [],
    private readonly defaultName?: string,
  ) {
    for (const plugin of plugins) this.register(plugin);
  }

  register(plugin: T): void {
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): T | undefined {
    return this.plugins.get(name);
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  names(): string[] {
    return Array.from(this.plugins.keys());
  }

  list(): T[] {
    return Array.from(this.plugins.values());
  }

  get defaultPlugin(): T | undefined {
    if (this.defaultName !== undefined)
      return this.plugins.get(this.defaultName);
    return this.plugins.values().next().value;
  }

  /**
   * The plugin a dag selects with its renderer directives.
   *
   * When a recipe names several registered renderers, the last one declared
   * wins, matching the "later declarations override earlier" precedence used
   * for style properties. Names that are not registered are skipped, and a dag
   * that selects nothing registered falls back to the default.
   */
  resolveFor(dag: Dag): T | undefined {
    const directiveNames = Array.from(dag.getRendererDirectives().keys());
    const selectedName = directiveNames.findLast((name) =>
      this.plugins.has(name),
    );
    const selected =
      selectedName !== undefined ? this.plugins.get(selectedName) : undefined;
    return selected ?? this.defaultPlugin;
  }
}
