import { Core } from "cytoscape";
import { CyDiffResult } from "./cyDiffer";

export function applyDiff(cy: Core, diff: CyDiffResult): void {
  cy.batch(() => {
    for (const id of [...diff.nodesToRemove, ...diff.edgesToRemove]) {
      cy.getElementById(id).remove();
    }
    cy.add(diff.nodesToAdd);
    cy.add(diff.edgesToAdd);
    for (const upd of [...diff.nodesToUpdate, ...diff.edgesToUpdate]) {
      const ele = cy.getElementById(upd.id);
      ele.data(upd.data);
      if (upd.classes !== undefined) ele.classes(upd.classes);
    }
  });
}
