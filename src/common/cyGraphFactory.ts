import {
  EdgeDefinition,
  ElementsDefinition,
  NodeDefinition,
  Stylesheet,
} from "cytoscape";
import { DESCRIPTION_PROPERTY, TOP_LEVEL_DAG_ID } from "./constants";
import { Dag, StyleProperties } from "./dag";

// a list of known property prefixes that should not be passed to cytoscape
const NON_CYTOSCAPE_PROPERTY_PREFIXES: string[] = [
  DESCRIPTION_PROPERTY, // this captures description and all description-*
];

export function keyStartsWithNonCytoscapePrefix(key: string): boolean {
  return NON_CYTOSCAPE_PROPERTY_PREFIXES.some((nonCytoscapePropertyPrefix) =>
    key.startsWith(nonCytoscapePropertyPrefix),
  );
}

export function filterCytoscapeProperties(
  styleProperties: StyleProperties,
): StyleProperties {
  return new Map(
    Array.from(styleProperties.entries()).filter(
      ([key, _]) => !keyStartsWithNonCytoscapePrefix(key),
    ),
  );
}

function makeCyCompoundNode(dag: Dag): NodeDefinition {
  const parentId = dag.Parent?.Id;
  return {
    data: {
      id: dag.Id,
      name: dag.Name,
      ...(parentId && parentId !== TOP_LEVEL_DAG_ID && { parent: parentId }),
    },
  };
}

export function makeCyNodes(dag: Dag): NodeDefinition[] {
  return dag.getNodeList().map((node) => ({
    data: {
      id: node.id,
      name: node.name,
      ...(dag.Id !== TOP_LEVEL_DAG_ID && { parent: dag.Id }),
    },
    ...(node.styleTags.length > 0 && {
      classes: node.styleTags.join(" "),
    }),
  }));
}

export function makeCyEdges(dag: Dag): EdgeDefinition[] {
  return dag.getEdgeList().map((edge) => ({
    data: {
      id: edge.id,
      source: edge.srcNodeId,
      target: edge.destNodeId,
      name: edge.name,
    },
    ...(edge.styleTags.length > 0 && {
      classes: edge.styleTags.join(" "),
    }),
  }));
}

export function makeCyElements(dag: Dag): ElementsDefinition {
  const nodeList = makeCyNodes(dag);
  const edgeList = makeCyEdges(dag);

  const childElements = dag.getChildDags().map(makeCyElements);
  nodeList.push(...childElements.flatMap((elementDefs) => elementDefs.nodes));
  edgeList.push(...childElements.flatMap((elementDefs) => elementDefs.edges));

  if (dag.Id !== TOP_LEVEL_DAG_ID && nodeList.length > 0) {
    nodeList.push(makeCyCompoundNode(dag));
  }

  return { nodes: nodeList, edges: edgeList };
}

export function makeNodeStylesheets(dag: Dag): Stylesheet[] {
  return dag
    .getNodeList()
    .filter((node) => node.styleProperties.size > 0)
    .map((node) => ({
      selector: `node#${node.id}`,
      style: Object.fromEntries(
        filterCytoscapeProperties(node.styleProperties),
      ),
    }));
}

export function makeEdgeStyleSheets(dag: Dag): Stylesheet[] {
  return dag
    .getEdgeList()
    .filter((edge) => edge.styleProperties.size > 0)
    .map((edge) => ({
      selector: `edge#${edge.id}`,
      style: Object.fromEntries(
        filterCytoscapeProperties(edge.styleProperties),
      ),
    }));
}

export function makeClassStyleSheets(dag: Dag): Stylesheet[] {
  return Array.from(dag.getFlattenedStyles()).map(
    ([styleTag, styleProperties]) => ({
      selector: "." + styleTag,
      style: Object.fromEntries(filterCytoscapeProperties(styleProperties)),
    }),
  );
}

export function makeNameStyleSheets(dag: Dag): Stylesheet[] {
  const flatStyleMap = dag.getFlattenedStyles();
  return Array.from(dag.getStyleBindings())
    .flatMap(([keyword, styleTags]) =>
      styleTags.map((styleTag) => {
        const styleProperties = flatStyleMap.get(styleTag);
        if (styleProperties) {
          return {
            selector: `[name ='${keyword}']`,
            style: Object.fromEntries(
              filterCytoscapeProperties(styleProperties),
            ),
          };
        } else {
          console.log(`keyword ${keyword} could not be bound to ${styleTag}`);
          return null;
        }
      }),
    )
    .filter(Boolean) as Stylesheet[];
}

export function makeCyStylesheets(dag: Dag): Stylesheet[] {
  const workingStylesheets: Stylesheet[] = [
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
      },
    },
    {
      selector: "node",
      style: {
        label: "data(name)",
        "text-valign": "bottom",
        "text-wrap": "wrap",
      },
    },
  ];
  const nodeStyles = makeNodeStylesheets(dag);
  workingStylesheets.push(...nodeStyles);

  const edgeStyles = makeEdgeStyleSheets(dag);
  workingStylesheets.push(...edgeStyles);

  const classStyles = makeClassStyleSheets(dag);
  workingStylesheets.push(...classStyles);

  const nameStyles = makeNameStyleSheets(dag);
  workingStylesheets.push(...nameStyles);

  return workingStylesheets;
}
