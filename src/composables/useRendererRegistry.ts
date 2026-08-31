import { shallowRef, computed, markRaw } from "vue";
import { Dag } from "../compiler/dag";
import {
  ExportFormat,
  RendererComponent,
  RendererPlugin,
  RendererRegistry,
} from "../rendererApi";

/**
 * Resolves which renderer draws the dag from the dag itself.
 *
 * A recipe selects its renderer with a '^<rendererName>{ }' directive; see
 * RendererRegistry.resolveFor for how a name is matched and what happens when
 * a recipe names several. This composable adds nothing but Vue reactivity on
 * top of that, so the editor and the CLI resolve renderers identically.
 */
export function useRendererRegistry(
  getDag: () => Dag,
  plugins: readonly RendererPlugin[],
) {
  // markRaw keeps Vue from walking into renderer components and their
  // completion tables, which are plain data the app only ever reads.
  const registeredPlugins = shallowRef<readonly RendererPlugin[]>(
    plugins.map((plugin) => markRaw(plugin)),
  );

  const registry = computed(
    () => new RendererRegistry(registeredPlugins.value),
  );

  function registerRenderer(plugin: RendererPlugin): void {
    registeredPlugins.value = [...registeredPlugins.value, markRaw(plugin)];
  }

  const activePlugin = computed<RendererPlugin | undefined>(() =>
    registry.value.resolveFor(getDag()),
  );

  const activeRendererName = computed<string>(
    () => activePlugin.value?.name ?? "",
  );

  const rendererComponent = computed<RendererComponent | undefined>(
    () => activePlugin.value?.component,
  );

  const supportedExportFormats = computed<readonly ExportFormat[]>(
    () =>
      activePlugin.value?.supportedExportFormats ?? Object.values(ExportFormat),
  );

  // Names the editor offers after a '^'.
  const rendererNames = computed<string[]>(() => registry.value.names());

  return {
    activePlugin,
    activeRendererName,
    rendererComponent,
    supportedExportFormats,
    rendererNames,
    registerRenderer,
  };
}
