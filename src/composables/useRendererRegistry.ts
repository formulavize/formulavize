import { ref, shallowRef, computed, watch, markRaw } from "vue";
import {
  CYTOSCAPE_RENDERER_NAME,
  ExportFormat,
  MINIMAL_RENDERER_NAME,
} from "../compiler/constants";
import { RendererComponent } from "../compiler/rendererTypes";
import CytoscapeRenderer from "../renderers/cyDag/CytoscapeRenderer.vue";
import MinimalExampleRenderer from "../renderers/minExample/MinimalExampleRenderer.vue";

export function useRendererRegistry(
  initialRenderer: string = CYTOSCAPE_RENDERER_NAME,
  onRendererChanged?: () => void,
) {
  const registeredRenderers = new Map<string, RendererComponent>();
  const selectedRenderer = ref(initialRenderer);
  const rendererComponent = shallowRef<RendererComponent>(
    markRaw(CytoscapeRenderer) as RendererComponent,
  );

  function registerRenderer(id: string, renderer: RendererComponent): void {
    registeredRenderers.set(id, renderer);
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

  const rendererOptions = computed(() =>
    Array.from(registeredRenderers, ([id, renderer]) => ({
      id,
      name: renderer.displayName,
    })),
  );

  const supportedExportFormats = computed<readonly ExportFormat[]>(
    () =>
      rendererComponent.value.supportedExportFormats ||
      Object.values(ExportFormat),
  );

  watch(selectedRenderer, (newRendererId: string) => {
    const renderer = registeredRenderers.get(newRendererId);
    if (renderer) {
      rendererComponent.value = renderer;
      onRendererChanged?.();
    } else {
      console.error(`Renderer with id "${newRendererId}" not found`);
    }
  });

  return {
    selectedRenderer,
    rendererComponent,
    rendererOptions,
    supportedExportFormats,
    registerRenderer,
  };
}
