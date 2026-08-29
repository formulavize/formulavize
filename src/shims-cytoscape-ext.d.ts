// cytoscape-elk ships no typings and has no @types package. It is a plain
// cytoscape layout extension, so registering it is all we need typed; its
// option shape is declared in renderers/cyDag/cyLayout.ts.
declare module "cytoscape-elk" {
  import { Ext } from "cytoscape";
  const ext: Ext;
  export default ext;
}
