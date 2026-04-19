import { Core, NodeDefinition } from "cytoscape";
import { CyDiffResult } from "./cyDiffer";
import { DescriptionData } from "./cyPopperExtender";

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

/** Cytoscape style properties that can be set from description style properties. */
const SUPPORTED_CY_STYLE_PROPERTIES = new Set([
  "color",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "text-opacity",
]);

export interface GhostNodeSpec {
  id: string;
  definition: NodeDefinition;
  style: Record<string, string | number>;
}

export function makeGhostNodeSpecs(
  elementId: string,
  descriptions: DescriptionData[],
): GhostNodeSpec[] {
  return descriptions.map((desc, i) => {
    const styleOverrides: Record<string, string> = {};
    desc.descriptionStyleProperties.forEach((value, property) => {
      if (SUPPORTED_CY_STYLE_PROPERTIES.has(property)) {
        styleOverrides[property] = value;
      }
    });

    return {
      id: `__ghost_desc_${elementId}_${i}`,
      definition: {
        group: "nodes" as const,
        data: { id: `__ghost_desc_${elementId}_${i}` },
      },
      style: {
        label: desc.description,
        "background-opacity": 0,
        "border-width": 0,
        width: 1,
        height: 1,
        "text-valign": "center",
        "text-wrap": "wrap",
        ...styleOverrides,
      },
    };
  });
}
