import { Dag } from "../../compiler/dag";

/**
 * The text a minimal-renderer export contains.
 *
 * Shared by the component's download path and the headless path so both
 * produce identical output, mirroring how cyExport is shared in cyDag.
 */
export function makeDagSummaryText(dag: Dag): string {
  return `
Basic DAG Statistics
--------------------
Node Count: ${dag.getNodeList().length}
Edge Count: ${dag.getEdgeList().length}
  `.trim();
}
