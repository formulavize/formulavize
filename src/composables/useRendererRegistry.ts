import { shallowRef, computed, markRaw } from "vue";
import {
  CYTOSCAPE_RENDERER_NAME,
  ExportFormat,
  MINIMAL_RENDERER_NAME,
} from "../compiler/constants";
import { Dag } from "../compiler/dag";
import { RendererComponent } from "../compiler/rendererTypes";
import CytoscapeRenderer from "../renderers/cyDag/CytoscapeRenderer.vue";
import MinimalExampleRenderer from "../renderers/minExample/MinimalExampleRenderer.vue";

/**
 * Resolves which renderer draws the dag from the dag itself.
 *
 * A recipe selects its renderer with a '^<rendererName>{ }' directive. The
 * compiler does not validate the name against this registry, so directives
 * addressed to renderers that are not registered here are ignored. When a
 * recipe names several registered renderers, the last one declared wins,
 * matching the "later declarations override earlier" precedence used for
 * style properties.
 */
export function useRendererRegistry(getDag: () => Dag) {
  const registeredRenderers = shallowRef(new Map<string, RendererComponent>());

  function registerRenderer(id: string, renderer: RendererComponent): void {
    const updatedRenderers = new Map(registeredRenderers.value);
    updatedRenderers.set(id, markRaw(renderer) as RendererComponent);
    registeredRenderers.value = updatedRenderers;
  }

  // Register default renderers
  registerRenderer(
    CYTOSCAPE_RENDERER_NAME,
    markRaw(CytoscapeRenderer) as RendererComponent,
  );
  registerRenderer(
    MINIMAL_RENDERER_NAME,
    markRaw(MinimalExampleRenderer) as RendererComponent,
  );

  const activeRendererName = computed<string>(() => {
    const directiveNames = Array.from(getDag().getRendererDirectives().keys());
    const selectedName = directiveNames.findLast((rendererName) =>
      registeredRenderers.value.has(rendererName),
    );
    return selectedName ?? CYTOSCAPE_RENDERER_NAME;
  });

  const rendererComponent = computed<RendererComponent>(
    () =>
      registeredRenderers.value.get(activeRendererName.value) ??
      (markRaw(CytoscapeRenderer) as RendererComponent),
  );

  const supportedExportFormats = computed<readonly ExportFormat[]>(
    () =>
      rendererComponent.value.supportedExportFormats ||
      Object.values(ExportFormat),
  );

  return {
    activeRendererName,
    rendererComponent,
    supportedExportFormats,
    registerRenderer,
  };
}
