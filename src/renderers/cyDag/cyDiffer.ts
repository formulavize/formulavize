import {
  NodeDefinition,
  EdgeDefinition,
  ElementsDefinition,
  NodeDataDefinition,
  EdgeDataDefinition,
} from "cytoscape";

type ElementId = string;
type ElementDef = NodeDefinition | EdgeDefinition;
type ElementDataDef = NodeDataDefinition | EdgeDataDefinition;

export interface NodeUpdate {
  id: ElementId;
  data: ElementDataDef;
  classes?: string;
}

export interface EdgeUpdate {
  id: ElementId;
  data: ElementDataDef;
  classes?: string;
}

export interface CyDiffResult {
  nodesToAdd: NodeDefinition[];
  nodesToRemove: ElementId[];
  nodesToUpdate: NodeUpdate[];
  edgesToAdd: EdgeDefinition[];
  edgesToRemove: ElementId[];
  edgesToUpdate: EdgeUpdate[];
  topologyChanged: boolean;
}

type CyScalarValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | CyScalarValue[];

function valueEqual(a: CyScalarValue, b: CyScalarValue): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => valueEqual(val, b[i]));
  }
  return false;
}

function dataEqual(a: ElementDataDef, b: ElementDataDef): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!valueEqual(a[key], b[key])) return false;
  }
  return true;
}

function normalizeClasses(
  classes: string | string[] | undefined,
): string | undefined {
  if (classes === undefined) return undefined;
  if (Array.isArray(classes)) return classes.join(" ");
  return classes;
}

function elementChanged(
  oldEl: ElementDef,
  newEl: ElementDef,
): { changed: boolean; newClasses: string | undefined } {
  const oldClasses = normalizeClasses(oldEl.classes);
  const newClasses = normalizeClasses(newEl.classes);
  return {
    changed: !dataEqual(oldEl.data, newEl.data) || oldClasses !== newClasses,
    newClasses,
  };
}

function indexById(elements: ElementDef[]): Map<ElementId, ElementDef> {
  return new Map(
    elements
      .filter((element) => element.data.id)
      .map((element) => [element.data.id as ElementId, element]),
  );
}

export function diffCyElements(
  oldElements: ElementsDefinition,
  newElements: ElementsDefinition,
): CyDiffResult {
  const oldNodes = indexById(oldElements.nodes);
  const newNodes = indexById(newElements.nodes);
  const oldEdges = indexById(oldElements.edges);
  const newEdges = indexById(newElements.edges);

  const nodesToAdd: NodeDefinition[] = [];
  const nodesToRemove: ElementId[] = [];
  const nodesToUpdate: NodeUpdate[] = [];
  const edgesToAdd: EdgeDefinition[] = [];
  const edgesToRemove: ElementId[] = [];
  const edgesToUpdate: EdgeUpdate[] = [];
  let topologyChanged = false;

  // Diff nodes
  for (const [id, newNode] of newNodes) {
    const oldNode = oldNodes.get(id);
    if (!oldNode) {
      nodesToAdd.push(newNode as NodeDefinition);
      topologyChanged = true;
    } else {
      const { changed, newClasses } = elementChanged(oldNode, newNode);
      if (changed) {
        nodesToUpdate.push({
          id,
          data: newNode.data as ElementDataDef,
          classes: newClasses,
        });
      }
    }
  }
  for (const id of oldNodes.keys()) {
    if (!newNodes.has(id)) {
      nodesToRemove.push(id);
      topologyChanged = true;
    }
  }

  // Diff edges
  for (const [id, newEdge] of newEdges) {
    const oldEdge = oldEdges.get(id);
    if (!oldEdge) {
      edgesToAdd.push(newEdge as EdgeDefinition);
      topologyChanged = true;
    } else {
      if (
        oldEdge.data.source !== newEdge.data.source ||
        oldEdge.data.target !== newEdge.data.target
      ) {
        // Cytoscape edges have immutable source/target — must remove and re-add
        edgesToRemove.push(id);
        edgesToAdd.push(newEdge as EdgeDefinition);
        topologyChanged = true;
      } else {
        const { changed, newClasses } = elementChanged(oldEdge, newEdge);
        if (changed) {
          edgesToUpdate.push({
            id,
            data: newEdge.data as ElementDataDef,
            classes: newClasses,
          });
        }
      }
    }
  }
  for (const id of oldEdges.keys()) {
    if (!newEdges.has(id)) {
      edgesToRemove.push(id);
      topologyChanged = true;
    }
  }

  return {
    nodesToAdd,
    nodesToRemove,
    nodesToUpdate,
    edgesToAdd,
    edgesToRemove,
    edgesToUpdate,
    topologyChanged,
  };
}
