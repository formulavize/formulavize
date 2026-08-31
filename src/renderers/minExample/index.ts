import { RendererPlugin } from "../../rendererApi";
import MinimalExampleRenderer from "./MinimalExampleRenderer.vue";
import { minimalRendererMeta } from "./meta";

export { MINIMAL_RENDERER_NAME } from "./meta";

/**
 * A minimal renderer plugin - a worked-through example of the renderer contract.
 */
export const minimalPlugin: RendererPlugin = {
  ...minimalRendererMeta,
  component: MinimalExampleRenderer,
};
