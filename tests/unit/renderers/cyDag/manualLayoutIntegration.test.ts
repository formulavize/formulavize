import { describe, test, expect } from "vitest";
import cytoscape, { Core } from "cytoscape";
import { Compiler } from "src/compiler/driver";
import { makeCyElements } from "src/renderers/cyDag/cyGraphFactory";
import {
  makeLayoutOptions,
  isManualLayout,
} from "src/renderers/cyDag/cyLayout";
import {
  captureNodePositions,
  applyNodePositions,
} from "src/renderers/cyDag/cyNodePositions";

const MANUAL_DIRECTIVE = '^cytoscape{ layout: "manual" }\n';

async function addRecipe(cy: Core, source: string) {
  const { DAG } = await new Compiler().compileFromSource(source);
  cy.add(makeCyElements(DAG));
  return DAG;
}

/**
 * Mirrors what CytoscapeRenderer.updateDag does on a topology change: capture
 * the arrangement, rebuild the element set from the new dag, put it back.
 */
async function recompileInto(cy: Core, source: string) {
  const dag = (await new Compiler().compileFromSource(source)).DAG;
  const positions = isManualLayout(dag) ? captureNodePositions(cy) : null;
  cy.elements().remove();
  cy.add(makeCyElements(dag));
  if (positions) applyNodePositions(cy, positions);
  return dag;
}

describe("manual layout integration", () => {
  test("running the layout leaves dragged nodes alone", async () => {
    const cy = cytoscape({ headless: true });
    const dag = await addRecipe(cy, `${MANUAL_DIRECTIVE}a = load()\nrun(a)\n`);

    const dragged = cy.getElementById("root-n-load-0");
    dragged.position({ x: 250, y: 75 });
    cy.layout(makeLayoutOptions(dag)).run();

    expect(dragged.position()).toEqual({ x: 250, y: 75 });
    cy.destroy();
  });

  test("an arrangement survives an edit that rebuilds the graph", async () => {
    const cy = cytoscape({ headless: true });
    const recipe = `${MANUAL_DIRECTIVE}a = load()\nrun(a)\n`;
    await addRecipe(cy, recipe);

    cy.getElementById("root-n-load-0").position({ x: 250, y: 75 });
    cy.getElementById("root-n-run-0").position({ x: 250, y: 275 });

    // Node ids are stable across recompiles, so appending a statement leaves
    // the two arranged nodes addressable by the same ids.
    await recompileInto(cy, `${recipe}report(a)\n`);

    expect(cy.getElementById("root-n-load-0").position()).toEqual({
      x: 250,
      y: 75,
    });
    expect(cy.getElementById("root-n-run-0").position()).toEqual({
      x: 250,
      y: 275,
    });
    cy.destroy();
  });

  test("a node added by an edit appears below the node it consumes", async () => {
    const cy = cytoscape({ headless: true });
    const recipe = `${MANUAL_DIRECTIVE}a = load()\nrun(a)\n`;
    await addRecipe(cy, recipe);

    cy.getElementById("root-n-load-0").position({ x: 250, y: 75 });
    cy.getElementById("root-n-run-0").position({ x: 250, y: 275 });

    await recompileInto(cy, `${recipe}report(a)\n`);

    const added = cy.getElementById("root-n-report-0").position();
    expect(added.x).toBeCloseTo(250);
    expect(added.y).toBeGreaterThan(75);
    cy.destroy();
  });

  test("nodes inside a namespace keep their positions", async () => {
    const cy = cytoscape({ headless: true });
    const recipe = `${MANUAL_DIRECTIVE}group[\n  x = step()\n]\n`;
    await addRecipe(cy, recipe);

    const inner = cy.getElementById("root-ns-group-0-n-step-0");
    expect(inner.length).toBe(1);
    inner.position({ x: 120, y: 340 });

    await recompileInto(cy, `${recipe}after()\n`);

    expect(cy.getElementById("root-ns-group-0-n-step-0").position()).toEqual({
      x: 120,
      y: 340,
    });
    cy.destroy();
  });
});
