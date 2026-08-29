import { Core, NodeSingular, Position } from "cytoscape";

export type NodePositions = Map<string, Position>;

// How far below its predecessors a newly appeared node is dropped, and how far
// each further new node is cascaded so a batch of them never lands in one pile.
// Both are arbitrary pixel amounts chosen to clear a default-sized node.
const SUCCESSOR_GAP = 100;
const CASCADE_STEP = 30;

/**
 * Positions of the graph's leaf nodes, keyed by element id.
 *
 * Compound (namespace) nodes are skipped: cytoscape derives a parent's position
 * from its children, and assigning one translates the whole subtree, so
 * restoring a parent would move its children a second time.
 */
export function captureNodePositions(cy: Core): NodePositions {
  const positions: NodePositions = new Map();
  cy.nodes().forEach((node) => {
    if (!node.isChildless()) return;
    const { x, y } = node.position();
    positions.set(node.id(), { x, y });
  });
  return positions;
}

// Somewhere visible for a node with nothing placed to anchor it to. cy.extent()
// is the model-space rectangle currently on screen; manual mode does not refit
// the viewport, so the origin may well be off screen by now.
function viewportCenter(cy: Core): Position {
  const extent = cy.extent();
  return { x: (extent.x1 + extent.x2) / 2, y: (extent.y1 + extent.y2) / 2 };
}

// Below the node's placed predecessors, or above its placed successors, so a
// node added mid-recipe shows up next to the nodes it connects to rather than
// wherever the origin happens to be.
function anchorToNeighbors(
  node: NodeSingular,
  placed: NodePositions,
): Position | undefined {
  // incomers/outgoers are typed as a mixed element collection even when
  // filtered to nodes, and only the id is read here.
  const positionsOf = (neighbors: { id(): string }[]): Position[] =>
    neighbors
      .map((neighbor) => placed.get(neighbor.id()))
      .filter((position): position is Position => position !== undefined);

  const incoming = positionsOf(node.incomers("node").toArray());
  if (incoming.length > 0) {
    const x = incoming.reduce((sum, p) => sum + p.x, 0) / incoming.length;
    const y = Math.max(...incoming.map((p) => p.y));
    return { x, y: y + SUCCESSOR_GAP };
  }

  const outgoing = positionsOf(node.outgoers("node").toArray());
  if (outgoing.length > 0) {
    const x = outgoing.reduce((sum, p) => sum + p.x, 0) / outgoing.length;
    const y = Math.min(...outgoing.map((p) => p.y));
    return { x, y: y - SUCCESSOR_GAP };
  }

  return undefined;
}

/**
 * Put nodes back where they were, by id, and give any node that has no recorded
 * position a visible one.
 *
 * Ids are stable across recompiles (see StableIdContext in dagFactory), so an
 * edit that rebuilds the graph leaves a manually arranged node under the cursor
 * it was dragged to. Ids with no surviving node are ignored.
 *
 * Every remembered node is restored before any new one is anchored, so a new
 * node sees all of its surviving neighbors. New nodes are then visited in
 * cytoscape's collection order, which is the dag's insertion order, so a chain
 * of them anchors off the node before it rather than all landing in one spot.
 */
export function applyNodePositions(cy: Core, positions: NodePositions): void {
  const placed: NodePositions = new Map();
  const unplaced: NodeSingular[] = [];

  cy.nodes().forEach((node) => {
    if (!node.isChildless()) return;
    const remembered = positions.get(node.id());
    if (!remembered) {
      unplaced.push(node);
      return;
    }
    node.position(remembered);
    placed.set(node.id(), remembered);
  });

  unplaced.forEach((node, cascade) => {
    const anchor = anchorToNeighbors(node, placed) ?? viewportCenter(cy);
    // Cascaded so that new nodes sharing an anchor (siblings off one
    // predecessor, or nothing to anchor to at all) do not stack up.
    const position = {
      x: anchor.x + cascade * CASCADE_STEP,
      y: anchor.y + cascade * CASCADE_STEP,
    };
    node.position(position);
    placed.set(node.id(), position);
  });
}
