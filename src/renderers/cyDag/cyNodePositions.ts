import { BoundingBox12, Core, NodeSingular, Position } from "cytoscape";

export type NodePositions = Map<string, Position>;

// How far below its predecessors a newly appeared node is dropped. An arbitrary
// pixel amount chosen to clear a default-sized node.
const SUCCESSOR_GAP = 100;
// How far a new node is shifted, and how many times, when its first choice of
// spot is already occupied. Diagonal so it escapes a column of nodes as
// readily as a row of them, and small enough that it settles beside the
// arrangement rather than being flung out of the viewport.
const NUDGE_STEP = 30;
const MAX_NUDGES = 200;

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

function boxesOverlap(a: BoundingBox12, b: BoundingBox12): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

/**
 * Move a node to `anchor`, then step it away until it covers nothing.
 *
 * Labels sit under their node body (`text-valign: bottom`), so a new node
 * dropped on an occupied spot hides the label of whatever is underneath it —
 * from the outside that looks like labels vanishing, not like an overlap. The
 * boxes therefore include labels, so a node clears the text as well as the
 * bodies. Obstacles are the nodes placed so far, which is also what keeps a
 * batch of new nodes from landing in one pile.
 */
function placeClearOfObstacles(
  node: NodeSingular,
  anchor: Position,
  obstacles: NodeSingular[],
): void {
  const boxOf = (n: NodeSingular): BoundingBox12 =>
    n.boundingBox({ includeLabels: true });
  const isOccupied = (): boolean =>
    obstacles.some((other) => boxesOverlap(boxOf(node), boxOf(other)));

  node.position(anchor);
  for (let nudge = 1; nudge <= MAX_NUDGES && isOccupied(); nudge++) {
    node.position({
      x: anchor.x + nudge * NUDGE_STEP,
      y: anchor.y + nudge * NUDGE_STEP,
    });
  }
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
 * Each is finally stepped clear of everything placed before it, since neither
 * the viewport centre nor a fixed gap below a predecessor is guaranteed to be
 * free.
 */
export function applyNodePositions(cy: Core, positions: NodePositions): void {
  const placed: NodePositions = new Map();
  const obstacles: NodeSingular[] = [];
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
    obstacles.push(node);
  });

  unplaced.forEach((node) => {
    const anchor = anchorToNeighbors(node, placed) ?? viewportCenter(cy);
    placeClearOfObstacles(node, anchor, obstacles);
    placed.set(node.id(), node.position());
    obstacles.push(node);
  });
}
