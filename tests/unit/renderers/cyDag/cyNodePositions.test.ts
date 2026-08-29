import { describe, test, expect } from "vitest";
import cytoscape, { Core, ElementsDefinition, NodeSingular } from "cytoscape";
import {
  captureNodePositions,
  applyNodePositions,
} from "src/renderers/cyDag/cyNodePositions";

function makeCy(elements: ElementsDefinition): Core {
  return cytoscape({ headless: true, elements });
}

function chain(): ElementsDefinition {
  return {
    nodes: [{ data: { id: "a" } }, { data: { id: "b" } }],
    edges: [{ data: { id: "a->b", source: "a", target: "b" } }],
  };
}

function overlap(first: NodeSingular, second: NodeSingular): boolean {
  const a = first.boundingBox();
  const b = second.boundingBox();
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

describe("capturing node positions", () => {
  test("records every leaf node by id", () => {
    const cy = makeCy(chain());
    cy.getElementById("a").position({ x: 10, y: 20 });
    cy.getElementById("b").position({ x: 30, y: 40 });

    expect(captureNodePositions(cy)).toEqual(
      new Map([
        ["a", { x: 10, y: 20 }],
        ["b", { x: 30, y: 40 }],
      ]),
    );
  });

  test("skips compound nodes, whose position follows their children", () => {
    const cy = makeCy({
      nodes: [
        { data: { id: "group" } },
        { data: { id: "child", parent: "group" } },
      ],
      edges: [],
    });
    cy.getElementById("child").position({ x: 5, y: 5 });

    expect([...captureNodePositions(cy).keys()]).toEqual(["child"]);
  });
});

describe("applying node positions", () => {
  test("puts surviving nodes back where they were", () => {
    const cy = makeCy(chain());
    cy.getElementById("a").position({ x: 10, y: 20 });
    cy.getElementById("b").position({ x: 30, y: 40 });
    const positions = captureNodePositions(cy);

    // The renderer rebuilds the graph from scratch on a topology change.
    cy.elements().remove();
    cy.add(chain());
    expect(cy.getElementById("a").position()).toEqual({ x: 0, y: 0 });

    applyNodePositions(cy, positions);
    expect(cy.getElementById("a").position()).toEqual({ x: 10, y: 20 });
    expect(cy.getElementById("b").position()).toEqual({ x: 30, y: 40 });
  });

  test("ignores ids that no longer exist", () => {
    const cy = makeCy(chain());
    const positions = new Map([
      ["a", { x: 10, y: 20 }],
      ["gone", { x: 99, y: 99 }],
    ]);

    expect(() => applyNodePositions(cy, positions)).not.toThrow();
    expect(cy.getElementById("a").position()).toEqual({ x: 10, y: 20 });
  });

  test("does not move a compound parent out from under its children", () => {
    const cy = makeCy({
      nodes: [
        { data: { id: "group" } },
        { data: { id: "child", parent: "group" } },
      ],
      edges: [],
    });

    applyNodePositions(cy, new Map([["group", { x: 500, y: 500 }]]));
    expect(cy.getElementById("child").position()).not.toEqual({
      x: 500,
      y: 500,
    });
  });

  test("drops a new node below the predecessor it was added after", () => {
    const cy = makeCy(chain());
    applyNodePositions(cy, new Map([["a", { x: 10, y: 20 }]]));

    const added = cy.getElementById("b").position();
    expect(added.x).toBe(10);
    expect(added.y).toBeGreaterThan(20);
  });

  test("lifts a new node above the successor it feeds", () => {
    const cy = makeCy(chain());
    applyNodePositions(cy, new Map([["b", { x: 10, y: 20 }]]));

    const added = cy.getElementById("a").position();
    expect(added.x).toBe(10);
    expect(added.y).toBeLessThan(20);
  });

  test("anchors a new node between its placed predecessors", () => {
    const cy = makeCy({
      nodes: [
        { data: { id: "a" } },
        { data: { id: "b" } },
        { data: { id: "c" } },
      ],
      edges: [
        { data: { id: "a->c", source: "a", target: "c" } },
        { data: { id: "b->c", source: "b", target: "c" } },
      ],
    });

    applyNodePositions(
      cy,
      new Map([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 100, y: 40 }],
      ]),
    );

    const added = cy.getElementById("c").position();
    expect(added.x).toBe(50);
    expect(added.y).toBeGreaterThan(40);
  });

  test("chains of new nodes follow each other rather than piling up", () => {
    const cy = makeCy({
      nodes: [
        { data: { id: "a" } },
        { data: { id: "b" } },
        { data: { id: "c" } },
      ],
      edges: [
        { data: { id: "a->b", source: "a", target: "b" } },
        { data: { id: "b->c", source: "b", target: "c" } },
      ],
    });

    applyNodePositions(cy, new Map([["a", { x: 0, y: 0 }]]));

    const b = cy.getElementById("b").position();
    const c = cy.getElementById("c").position();
    expect(b.y).toBeGreaterThan(0);
    expect(c.y).toBeGreaterThan(b.y);
  });

  test("unconnected new nodes land on screen instead of at the origin", () => {
    const cy = makeCy({
      nodes: [{ data: { id: "a" } }, { data: { id: "b" } }],
      edges: [],
    });
    // Stand in for a panned viewport; headless cytoscape reports a unit extent.
    cy.extent = () => ({ x1: 100, x2: 300, y1: 100, y2: 300, w: 200, h: 200 });

    applyNodePositions(cy, new Map());

    const first = cy.getElementById("a").position();
    const second = cy.getElementById("b").position();
    expect(first).toEqual({ x: 200, y: 200 });
    // Stepped aside so a batch of unconnected nodes is not one unclickable stack.
    expect(second).not.toEqual(first);
  });

  test("keeps an unconnected new node off the nodes already placed", () => {
    const cy = makeCy({
      nodes: [
        { data: { id: "a" } },
        { data: { id: "b" } },
        { data: { id: "c" } },
      ],
      edges: [{ data: { id: "b->a", source: "b", target: "a" } }],
    });
    // A fitted graph sits in the middle of the viewport, so the centre an
    // unanchored node falls back to is the one spot already occupied. Dropping
    // it there hides the labels of whatever it covers.
    cy.extent = () => ({ x1: -85, x2: 115, y1: 20, y2: 170, w: 200, h: 150 });

    applyNodePositions(
      cy,
      new Map([
        ["a", { x: 15, y: 95 }],
        ["b", { x: 15, y: 15 }],
      ]),
    );

    const added = cy.getElementById("c");
    expect(overlap(added, cy.getElementById("a"))).toBe(false);
    expect(overlap(added, cy.getElementById("b"))).toBe(false);
  });

  test("keeps a new successor off a sibling already sitting below", () => {
    const cy = makeCy({
      nodes: [
        { data: { id: "a" } },
        { data: { id: "b" } },
        { data: { id: "c" } },
      ],
      edges: [
        { data: { id: "a->b", source: "a", target: "b" } },
        { data: { id: "a->c", source: "a", target: "c" } },
      ],
    });

    // 'b' is parked exactly one successor gap below 'a', which is where 'c'
    // would otherwise be dropped.
    applyNodePositions(
      cy,
      new Map([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 0, y: 100 }],
      ]),
    );

    expect(overlap(cy.getElementById("c"), cy.getElementById("b"))).toBe(false);
  });
});
