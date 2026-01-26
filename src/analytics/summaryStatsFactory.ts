import { Compilation } from "../compiler/compilation";
import { Dag, DagElement } from "../compiler/dag";
import {
  SummaryStats,
  DagStructuralStats,
  NamespaceStats,
  StylingStats,
  VariableStats,
  ImportStats,
  NamingStats,
} from "./summaryStats";

function collectAllDags(dag: Dag): Dag[] {
  // Collect all DAGs including child DAGs recursively
  function traverse(d: Dag, visited: Set<string>): Dag[] {
    if (visited.has(d.Id)) return [];
    const newVisited = new Set(visited).add(d.Id);
    return [
      d,
      ...d.getChildDags().flatMap((child) => traverse(child, newVisited)),
    ];
  }
  return traverse(dag, new Set());
}

function calculateMaxNestingDepth(dag: Dag, currentDepth: number): number {
  const childDags = dag.getChildDags();
  if (childDags.length === 0) return currentDepth;

  const maxDepth = Math.max(
    currentDepth,
    ...childDags.map((child) =>
      calculateMaxNestingDepth(child, currentDepth + 1),
    ),
  );

  return maxDepth;
}

const sumNumList = (list: number[]) => list.reduce((a, b) => a + b, 0);

function calculateStructuralStats(dag: Dag): DagStructuralStats {
  const allDags = collectAllDags(dag);
  const maxNestingDepth = calculateMaxNestingDepth(dag, 0);

  const totalNodeCount = allDags.reduce(
    (sum, d) => sum + d.getNodeList().length,
    0,
  );
  const totalEdgeCount = allDags.reduce(
    (sum, d) => sum + d.getEdgeList().length,
    0,
  );

  const allEdges = allDags.flatMap((d) => d.getEdgeList());
  const nodeToInEdges = allEdges.reduce((map, edge) => {
    map.set(edge.destNodeId, (map.get(edge.destNodeId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const nodeToOutEdges = allEdges.reduce((map, edge) => {
    map.set(edge.srcNodeId, (map.get(edge.srcNodeId) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const maxInDegree = Math.max(0, ...Array.from(nodeToInEdges.values()));
  const maxOutDegree = Math.max(0, ...Array.from(nodeToOutEdges.values()));
  const avgInDegree =
    totalNodeCount > 0
      ? sumNumList(Array.from(nodeToInEdges.values())) / totalNodeCount
      : 0;
  const avgOutDegree =
    totalNodeCount > 0
      ? sumNumList(Array.from(nodeToOutEdges.values())) / totalNodeCount
      : 0;

  return {
    nodeCount: totalNodeCount,
    edgeCount: totalEdgeCount,
    maxNestingDepth,
    totalChildDags: allDags.length - 1, // Exclude root DAG
    maxInDegree,
    maxOutDegree,
    avgInDegree,
    avgOutDegree,
  };
}

function calculateDepth(dag: Dag, visited: Set<string> = new Set()): number {
  if (dag.Parent === null) return 0;
  if (visited.has(dag.Id)) return 0;
  visited.add(dag.Id);
  return 1 + calculateDepth(dag.Parent, visited);
}

const avgNumList = (list: number[]): number => {
  return list.length > 0 ? sumNumList(list) / list.length : 0;
};

function calculateNamespaceStats(dag: Dag): NamespaceStats {
  const allDags = collectAllDags(dag);
  const namespacedDags = allDags.filter((d) => d.Name !== "");
  const namespaceCount = namespacedDags.length;

  const depths = namespacedDags.map((d) => calculateDepth(d));
  const maxNamespaceDepth = Math.max(0, ...depths);
  const avgNamespaceDepth = avgNumList(depths);

  return {
    namespaceCount,
    maxNamespaceDepth,
    avgNamespaceDepth,
  };
}

function getDagNodesAndEdges(dag: Dag): DagElement[] {
  return [...dag.getNodeList(), ...dag.getEdgeList()];
}

function getDagElements(dag: Dag): DagElement[] {
  return [...getDagNodesAndEdges(dag), dag.getDagAsDagNode()];
}

function calculateStylingStats(dag: Dag): StylingStats {
  const allDags = collectAllDags(dag);
  const allElements = allDags.flatMap(getDagElements);

  const totalStyleTagCount = allElements.reduce(
    (sum, element) => sum + element.styleTags.length,
    0,
  );

  const totalStylePropertyCount = allElements.reduce(
    (sum, element) => sum + element.styleProperties.size,
    0,
  );

  const totalElementCount = allElements.length;

  const taggedStyleCount = allElements.reduce(
    (count, element) => count + (element.styleTags.length > 0 ? 1 : 0),
    0,
  );

  const inlineStyleCount = allElements.reduce(
    (count, element) => count + (element.styleProperties.size > 0 ? 1 : 0),
    0,
  );

  const styleBindingCount = allDags.reduce(
    (sum, d) => sum + d.getStyleBindings().size,
    0,
  );

  return {
    totalStyleTagCount,
    totalStylePropertyCount,
    avgStyleTagsPerElement:
      totalElementCount > 0 ? totalStyleTagCount / totalElementCount : 0,
    avgStylePropertiesPerElement:
      totalElementCount > 0 ? totalStylePropertyCount / totalElementCount : 0,
    styleBindingCount,
    inlineStyleCount,
    taggedStyleCount,
  };
}

function getQualifiedStyleLengths(element: DagElement): number[] {
  return element.styleTags
    .filter((tag) => tag.length > 1)
    .map((tag) => tag.length);
}

function calculateVariableStats(dag: Dag): VariableStats {
  const allDags = collectAllDags(dag);

  const variableDeclarationCount = allDags.reduce(
    (sum, d) => sum + d.getVarNameToNodeIdMap().size,
    0,
  );

  const styleVariableDeclarationCount = allDags.reduce(
    (sum, d) => sum + d.getVarNameToStyleNodeMap().size,
    0,
  );

  const allElements = allDags.flatMap(getDagNodesAndEdges);
  const qualifiedStyleLengths = allElements.flatMap(getQualifiedStyleLengths);
  const qualifiedStyleUsageCount = qualifiedStyleLengths.length;
  const maxQualifiedStylePartLength = Math.max(0, ...qualifiedStyleLengths);
  const avgQualifiedStylePartLength = avgNumList(qualifiedStyleLengths);

  return {
    variableDeclarationCount,
    styleVariableDeclarationCount,
    qualifiedStyleUsageCount,
    maxQualifiedStylePartLength,
    avgQualifiedStylePartLength,
  };
}

function calculateImportStats(dag: Dag): ImportStats {
  const allDags = collectAllDags(dag);
  const allImports = allDags.flatMap((d) => Array.from(d.UsedImports));

  const importCount = allImports.length;
  const usedImports = new Set(allImports);
  const uniqueImportCount = usedImports.size;

  return {
    importCount,
    uniqueImportCount,
  };
}

function calculateNamingStats(dag: Dag): NamingStats {
  const allDags = collectAllDags(dag);

  const nodes = allDags.flatMap((d) => d.getNodeList());
  const nodeNameLengths = nodes.map((node) => node.name.length);

  const edges = allDags.flatMap((d) => d.getEdgeList());
  const namedEdges = edges.filter(
    (edge) => edge.name && edge.name.trim() !== "",
  );
  const edgeNameLengths = namedEdges.map((edge) => edge.name.length);

  return {
    namedEdgeCount: namedEdges.length,
    unnamedEdgeCount: edges.length - namedEdges.length,
    avgNodeNameLength: avgNumList(nodeNameLengths),
    avgEdgeNameLength: avgNumList(edgeNameLengths),
  };
}

export function createSummaryStats(compilation: Compilation): SummaryStats {
  const dag = compilation.DAG;

  const structural = calculateStructuralStats(dag);
  const namespace = calculateNamespaceStats(dag);
  const styling = calculateStylingStats(dag);
  const variable = calculateVariableStats(dag);
  const imports = calculateImportStats(dag);
  const naming = calculateNamingStats(dag);

  return new SummaryStats(
    structural,
    namespace,
    styling,
    variable,
    imports,
    naming,
  );
}
