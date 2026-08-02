import { Puzzlet } from "../lesson";
import { Compilation } from "src/compiler/compilation";
import { NodeType, NamedStyleTreeNode } from "src/compiler/ast";
import { DESCRIPTION_PROPERTY } from "src/compiler/constants";
import { normal, fast } from "../animationHelpers";
import { getStyleTaggedNodes } from "../winCheckHelpers";

const seeingRedPuzzlet: Puzzlet = {
  name: "Seeing Red",
  instructions: [
    normal("Functions can have styles to change node appearance.\n"),
    normal("Styles are defined in the { } to the right of a function.\n"),
    normal("Styles are denoted using 'key:value' pairs.\n"),
    normal("Keep to one 'key:value' pair per line unless ';' separated.\n"),
    normal("key is a (cytoscape.js) style property.\n"),
    normal("value is the (string|number|hex) value for that property.\n"),
    normal("Uncomment the styles to see node change."),
  ],
  examples: [
    fast("first() {\n"),
    fast("  //background-color: #FF0000\n"),
    fast('  //shape: "octagon"\n'),
    fast("  //outline-width: 1\n"),
    fast("}"),
  ],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: "Apply at least 1 style property to a node",
      check: (compilation: Compilation) =>
        compilation.DAG.getNodeList().some(
          (node) => node.styleProperties.size >= 1,
        ),
    },
    {
      description: "Apply at least 2 style properties to a node",
      check: (compilation: Compilation) =>
        compilation.DAG.getNodeList().some(
          (node) => node.styleProperties.size >= 2,
        ),
    },
    {
      description: "Apply at least 3 style properties to a node",
      check: (compilation: Compilation) =>
        compilation.DAG.getNodeList().some(
          (node) => node.styleProperties.size >= 3,
        ),
    },
  ],
};

const gettingTaggedPuzzlet: Puzzlet = {
  name: "Getting Tagged",
  instructions: [
    normal("Styles can be defined using #tags.\n"),
    normal("Define style tags with a hashtag '#', tag name, and { }.\n"),
    normal("e.g. #my_tag { }\n"),
    normal("Uncomment the tag to apply its styles to the function."),
  ],
  examples: [
    fast("#easy {\n"),
    fast('  background-color: "green"\n'),
    fast('  shape: "ellipse"\n'),
    fast("}\n"),
    fast("second() {\n"),
    fast("  //#easy\n"),
    fast("}\n"),
  ],
  successCriteria: [
    {
      description: "Apply a style tag with properties to a node",
      check: (compilation: Compilation) => {
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const nodes = compilation.DAG.getNodeList();
        return getStyleTaggedNodes(flattenedStyles, nodes).length > 0;
      },
    },
  ],
};

const mixAndMatchPuzzlet: Puzzlet = {
  name: "Mix and Match",
  instructions: [
    normal("Multiple tags can be specified in { }.\n"),
    normal("Tags should be separated by spaces ' '.\n"),
    normal("The styles from all tags in { } will be applied together.\n"),
    normal("Uncomment both style tags to apply their styles."),
  ],
  examples: [
    fast("#mix {\n"),
    fast('  background-color: "blue"\n'),
    fast("}\n"),
    fast("#match {\n"),
    fast('  shape: "rectangle"\n'),
    fast("}\n"),
    fast("third() {\n"),
    fast("  //#mix #match\n"),
    fast("}\n"),
  ],
  successCriteria: [
    {
      description: "Define at least 1 style tag with properties",
      check: (compilation: Compilation) => {
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        return (
          Array.from(flattenedStyles.values()).filter(
            (properties) => properties.size > 0,
          ).length >= 1
        );
      },
    },
    {
      description: "Define at least 2 style tags with properties",
      check: (compilation: Compilation) => {
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        return (
          Array.from(flattenedStyles.values()).filter(
            (properties) => properties.size > 0,
          ).length >= 2
        );
      },
    },
    {
      description: "Apply both style tags to a single node",
      check: (compilation: Compilation) => {
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const nodes = compilation.DAG.getNodeList();
        return getStyleTaggedNodes(flattenedStyles, nodes).some(
          (node) => node.styleTags.length >= 2,
        );
      },
    },
  ],
};

function getFlattenedMultiTagStyleNames(
  compilation: Compilation,
  minimumTagCount: number,
): string[] {
  const namedStyles = compilation.AST.Statements.filter(
    (stmt) => stmt.Type === NodeType.NamedStyle,
  ) as NamedStyleTreeNode[];
  const flattenedStyles = compilation.DAG.getFlattenedStyles();
  return namedStyles
    .filter((style) => style.StyleNode.StyleTags.length >= minimumTagCount)
    .map((style) => style.StyleName)
    .filter((styleName) => {
      const properties = flattenedStyles.get(styleName);
      return (properties?.size ?? 0) > 0;
    });
}

function hasCombinedStyleAppliedToMinimumNodes(
  compilation: Compilation,
  minimumTagCount: number,
  minimumNodeCount: number,
): boolean {
  const styleNames = getFlattenedMultiTagStyleNames(
    compilation,
    minimumTagCount,
  );
  const nodes = compilation.DAG.getNodeList();
  return styleNames.some((styleName) => {
    const styledUsers = nodes.filter((node) =>
      node.styleTags.some((tag) => tag.join(".") === styleName),
    );
    return styledUsers.length >= minimumNodeCount;
  });
}

const inStylePuzzlet: Puzzlet = {
  name: "In Style",
  instructions: [
    normal("Styles tags can also be put in another style tag's { }.\n"),
    normal("Uncomment the nested style tag to apply its styles."),
  ],
  examples: [
    fast('#black { background-color: "black" }\n'),
    fast('#diamond { shape: "diamond" }\n'),
    fast("#hard {\n"),
    fast("  #black // #diamond\n"),
    fast("}\n"),
    fast("fourth() { #hard }\n"),
    fast("fourth_too() { #hard }\n"),
  ],
  successCriteria: [
    {
      description: "Create a style tag containing 1 other style tag",
      check: (compilation: Compilation) =>
        getFlattenedMultiTagStyleNames(compilation, 1).length > 0,
    },
    {
      description: "Create a style tag containing 2 other style tags",
      check: (compilation: Compilation) =>
        getFlattenedMultiTagStyleNames(compilation, 2).length > 0,
    },
    {
      description: "Apply the combined style tag to at least 1 node",
      check: (compilation: Compilation) =>
        hasCombinedStyleAppliedToMinimumNodes(compilation, 1, 1),
    },
    {
      description: "Apply the combined style tag to at least 2 nodes",
      check: (compilation: Compilation) =>
        hasCombinedStyleAppliedToMinimumNodes(compilation, 2, 2),
    },
  ],
};

function hasEdgeTagWithMinimumProperties(
  compilation: Compilation,
  minimumPropertyCount: number,
): boolean {
  const flattenedStyles = compilation.DAG.getFlattenedStyles();
  return compilation.DAG.getEdgeList().some((edge) =>
    edge.styleTags.some((tag) => {
      const tagKey = tag.join(".");
      const properties = flattenedStyles.get(tagKey);
      return (properties?.size ?? 0) >= minimumPropertyCount;
    }),
  );
}

const silverLiningPuzzlet: Puzzlet = {
  name: "Silver Lining",
  instructions: [
    normal("Styles can be applied to edges too.\n"),
    normal("Edge styles are defined in a variable's { }.\n"),
    normal("Uncomment the variables styles to see the changes."),
  ],
  examples: [
    fast("#s {\n"),
    fast("  //width: 4\n"),
    fast('  //line-color: "silver"\n'),
    fast('  //line-style: "dashed"\n'),
    fast("}\n"),
    fast("x{ #s } = fifth()\n"),
    fast("fifth_too(x)\n"),
  ],
  successCriteria: [
    {
      description: "Apply at least 1 style property to an edge via tags",
      check: (compilation: Compilation) =>
        hasEdgeTagWithMinimumProperties(compilation, 1),
    },
    {
      description: "Apply at least 2 style properties to an edge via tags",
      check: (compilation: Compilation) =>
        hasEdgeTagWithMinimumProperties(compilation, 2),
    },
    {
      description: "Apply at least 3 style properties to an edge via tags",
      check: (compilation: Compilation) =>
        hasEdgeTagWithMinimumProperties(compilation, 3),
    },
  ],
};

const inABindPuzzlet: Puzzlet = {
  name: "In a Bind",
  instructions: [
    normal("Style bindings associate styles with keywords.\n"),
    normal("Define a binding with a percent sign '%', keyword, and { }.\n"),
    normal("e.g. %my_keyword{ }\n"),
    normal("Functions and variables with the keyword as its name\n"),
    normal("will receive the keyword's bound styles.\n"),
    normal("Uncomment the function call to see the binding in action."),
  ],
  examples: [
    fast('#starry { background-color: "gold"; shape: "star" }\n'),
    fast("%star { #starry }\n\n"),
    fast("// star()\n"),
  ],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: "Define a keyword binding with styles",
      check: (compilation: Compilation) => {
        const bindings = compilation.DAG.getStyleBindings();
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        return Array.from(bindings.values()).some(
          (dagStyle) =>
            dagStyle.styleProperties.size > 0 ||
            dagStyle.styleTags.some((styleTag) => {
              const properties = flattenedStyles.get(styleTag.join("."));
              return (properties?.size ?? 0) > 0;
            }),
        );
      },
    },
    {
      description: "Create a function matching the defined keyword",
      check: (compilation: Compilation) => {
        const bindings = compilation.DAG.getStyleBindings();
        const nodes = compilation.DAG.getNodeList();
        return Array.from(bindings.keys()).some((keyword) =>
          nodes.some((node) => node.name === keyword),
        );
      },
    },
  ],
};

const theAllStarsPuzzlet: Puzzlet = {
  name: "The All-Stars",
  instructions: [
    normal("Global style bindings apply styles to a graph element type.\n"),
    normal("node, edge, and subgraph are graph element types.\n"),
    normal("Define this binding with an asterisk '*', keyword, and { }\n"),
    normal("where keyword is the graph element type.\n"),
    normal("Uncomment the global style binding to see the changes."),
  ],
  examples: [
    fast('//*node{ text-valign: "center" }\n'),
    fast('//*edge{ line-style: "dotted" }\n'),
    fast('//*subgraph{ border-style: "dashed" }\n'),
    fast("y[seventh(sixth())]"),
  ],
  successCriteria: [
    {
      description: "Define a *node global binding",
      check: (compilation: Compilation) => {
        const bindings = compilation.DAG.getGlobalStyleBindings();
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const binding = bindings.get("node");
        if (!binding) return false;
        return (
          binding.styleProperties.size > 0 ||
          binding.styleTags.some((styleTag) => {
            const properties = flattenedStyles.get(styleTag.join("."));
            return (properties?.size ?? 0) > 0;
          })
        );
      },
    },
    {
      description: "Define an *edge global binding",
      check: (compilation: Compilation) => {
        const bindings = compilation.DAG.getGlobalStyleBindings();
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const binding = bindings.get("edge");
        if (!binding) return false;
        return (
          binding.styleProperties.size > 0 ||
          binding.styleTags.some((styleTag) => {
            const properties = flattenedStyles.get(styleTag.join("."));
            return (properties?.size ?? 0) > 0;
          })
        );
      },
    },
    {
      description: "Define a *subgraph global binding",
      check: (compilation: Compilation) => {
        const bindings = compilation.DAG.getGlobalStyleBindings();
        const flattenedStyles = compilation.DAG.getFlattenedStyles();
        const binding = bindings.get("subgraph");
        if (!binding) return false;
        return (
          binding.styleProperties.size > 0 ||
          binding.styleTags.some((styleTag) => {
            const properties = flattenedStyles.get(styleTag.join("."));
            return (properties?.size ?? 0) > 0;
          })
        );
      },
    },
  ],
};

const putALabelOnItPuzzlet: Puzzlet = {
  name: "Put a Label on it",
  instructions: [
    normal("The 'label' style property will override the current name.\n"),
    normal("Extra labels can be shown by adding strings to a { }\n"),
    normal("or by adding a 'description' property.\n"),
    normal("Descriptions are styled with description-* prefixed CSS.\n"),
    normal("Uncomment the strings in { } to see the changes."),
  ],
  examples: [
    fast("main_label() {\n"),
    fast("  description-font-size: 6px\n"),
    fast('  //"this extra label"\n'),
    fast('  //"spans two lines"\n'),
    fast("}\n"),
  ],
  successCriteria: [
    {
      description: "Add a multi-line description to a node",
      check: (compilation: Compilation) =>
        compilation.DAG.getNodeList().some((node) => {
          const descriptionValue =
            node.styleProperties.get(DESCRIPTION_PROPERTY);
          return descriptionValue?.includes("\n") ?? false;
        }),
    },
  ],
};

function checkBindingHasProperties(
  compilation: Compilation,
  keyword: string,
  expectedProps: string[],
): boolean {
  const bindings = compilation.DAG.getStyleBindings();
  const flattenedStyles = compilation.DAG.getFlattenedStyles();
  const dagStyle = bindings.get(keyword);
  if (!dagStyle?.styleTags.length && !dagStyle?.styleProperties.size)
    return false;
  const collectedProperties = new Set([
    ...Array.from(dagStyle.styleProperties.keys()),
    ...dagStyle.styleTags.flatMap((styleTag) => {
      const properties = flattenedStyles.get(styleTag.join("."));
      return properties ? Array.from(properties.keys()) : [];
    }),
  ]);
  return expectedProps.every((p) => collectedProperties.has(p));
}

const fizBuzzPuzzlet: Puzzlet = {
  name: "FizBuzz",
  instructions: [
    normal("It's time to mix things up!\n"),
    normal("Show that you've got style by refactoring the recipe below.\n"),
    normal("Make keyword bindings for water, seltzer, and serve.\n"),
    normal("Apply all existing style properties through these bindings."),
  ],
  examples: [
    fast('#temperature{ shape: "round-diamond" }\n'),
    fast('#hot{ background-color: "red" }\n'),
    fast('#cold{ background-color: "blue" }\n'),
    fast('#watery{ background-color: "lightblue" }\n'),
    fast('#can{ shape: "barrel" }\n'),
    fast("\n"),
    fast("%heat{ #temperature #hot }\n"),
    fast("%cool{ #temperature #cold }\n"),
    fast('%honey{ shape: "hexagon"; background-color: "gold" }\n'),
    fast("\n"),
    fast("w = water(){ #watery }\n"),
    fast("hot_water = heat(w)\n"),
    fast("h = honey()\n"),
    fast("honey_syrup = mix(hot_water, h)\n"),
    fast("buzz = cool(honey_syrup)\n"),
    fast("fizz = seltzer() { #watery #can }\n"),
    fast("drink = mix(fizz, buzz)\n"),
    fast("serve(drink) {\n"),
    fast('  shape: "bottom-round-rectangle"\n'),
    fast('  background-color: "silver"\n'),
    fast("}\n"),
  ],
  clearEditorOnStart: true,
  successCriteria: [
    {
      description: "Create a %water binding with background-color",
      check: (compilation: Compilation) =>
        checkBindingHasProperties(compilation, "water", ["background-color"]),
    },
    {
      description: "Create a %seltzer binding with background-color and shape",
      check: (compilation: Compilation) =>
        checkBindingHasProperties(compilation, "seltzer", [
          "background-color",
          "shape",
        ]),
    },
    {
      description: "Create a %serve binding with shape and background-color",
      check: (compilation: Compilation) =>
        checkBindingHasProperties(compilation, "serve", [
          "shape",
          "background-color",
        ]),
    },
  ],
};

export const styleModule = {
  name: "Style",
  puzzlets: [
    seeingRedPuzzlet,
    gettingTaggedPuzzlet,
    mixAndMatchPuzzlet,
    inStylePuzzlet,
    silverLiningPuzzlet,
    inABindPuzzlet,
    theAllStarsPuzzlet,
    putALabelOnItPuzzlet,
    fizBuzzPuzzlet,
  ],
};
