import { Puzzlet } from "../lesson";
import { Compilation } from "src/compiler/compilation";
import { NodeType, NamedStyleTreeNode } from "src/compiler/ast";
import { DESCRIPTION_PROPERTY } from "src/compiler/constants";
import { normal, fast } from "../animationHelpers";
import { getStyleTaggedNodes } from "../winCheckHelpers";

const stylePuzzlets: Puzzlet[] = [
  {
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
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().some(
        (node) => node.styleProperties.size >= 3,
      );
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      const flattenedStyles = compilation.DAG.getFlattenedStyles();
      const nodes = compilation.DAG.getNodeList();
      return getStyleTaggedNodes(flattenedStyles, nodes).length > 0;
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      const flattenedStyles = compilation.DAG.getFlattenedStyles();
      const nodes = compilation.DAG.getNodeList();
      const nonEmptyTagCount = Array.from(flattenedStyles.values()).filter(
        (properties) => properties.size > 0,
      ).length;
      if (nonEmptyTagCount < 2) return false;
      return getStyleTaggedNodes(flattenedStyles, nodes).some(
        (node) => node.styleTags.length >= 2,
      );
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      const flattenedStyles = compilation.DAG.getFlattenedStyles();
      const nonEmptyTagCount = Array.from(flattenedStyles.values()).filter(
        (properties) => properties.size > 0,
      ).length;
      if (nonEmptyTagCount < 3) return false;

      const namedStyles = compilation.AST.Statements.filter(
        (stmt) => stmt.Type === NodeType.NamedStyle,
      ) as NamedStyleTreeNode[];

      const multiTagStyleNames = namedStyles
        .filter((style) => style.StyleNode.StyleTags.length >= 2)
        .map((style) => style.StyleName)
        .filter((styleName) => {
          const properties = flattenedStyles.get(styleName);
          return (properties?.size ?? 0) > 0;
        });

      const nodes = compilation.DAG.getNodeList();
      return multiTagStyleNames.some((styleName) => {
        const styledUsers = nodes.filter((node) =>
          node.styleTags.some((tag) => tag.join(".") === styleName),
        );
        return styledUsers.length >= 2;
      });
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      const flattenedStyles = compilation.DAG.getFlattenedStyles();
      return compilation.DAG.getEdgeList().some((edge) => {
        return edge.styleTags.some((tag) => {
          const tagKey = tag.join(".");
          const properties = flattenedStyles.get(tagKey);
          return (properties?.size ?? 0) >= 3;
        });
      });
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      const bindings = compilation.DAG.getStyleBindings();
      const flattenedStyles = compilation.DAG.getFlattenedStyles();
      const nodes = compilation.DAG.getNodeList();

      // Find bindings that have style tags or inline properties
      return Array.from(bindings.entries()).some(([keyword, dagStyle]) => {
        const bindingHasProperties =
          dagStyle.styleProperties.size > 0 ||
          dagStyle.styleTags.some((styleTag) => {
            const tagName = styleTag.join(".");
            const properties = flattenedStyles.get(tagName);
            return (properties?.size ?? 0) > 0;
          });
        if (!bindingHasProperties) return false;

        // Check if any node uses this binding
        return nodes.some((node) => node.name === keyword);
      });
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      const bindings = compilation.DAG.getGlobalStyleBindings();
      const flattenedStyles = compilation.DAG.getFlattenedStyles();

      // Check that node, edge, and subgraph bindings exist and have properties
      return ["node", "edge", "subgraph"].every((elementType) => {
        const binding = bindings.get(elementType);
        if (!binding) return false;

        return (
          binding.styleProperties.size > 0 ||
          binding.styleTags.some((styleTag) => {
            const properties = flattenedStyles.get(styleTag.join("."));
            return (properties?.size ?? 0) > 0;
          })
        );
      });
    },
  },
  {
    name: "Put a Label on it",
    instructions: [
      normal("The 'label' style property will override the current name.\n"),
      normal("Extra labels can be shown by adding strings to a { }.\n"),
      normal("Uncomment the strings in { } to see the changes."),
    ],
    examples: [
      fast("main_label() {\n"),
      fast('  //"this extra label"\n'),
      fast('  //"spans two lines"\n'),
      fast("}\n"),
    ],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().some((node) => {
        const descriptionValue = node.styleProperties.get(DESCRIPTION_PROPERTY);
        return descriptionValue?.includes("\n") ?? false;
      });
    },
  },
  {
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
    successCondition: (compilation: Compilation) => {
      const expectedProperties = new Map([
        ["water", new Set(["background-color"])],
        ["seltzer", new Set(["background-color", "shape"])],
        ["serve", new Set(["shape", "background-color"])],
      ]);

      const bindings = compilation.DAG.getStyleBindings();
      const flattenedStyles = compilation.DAG.getFlattenedStyles();

      // Check that each required keyword has all expected properties
      return Array.from(expectedProperties.entries()).every(
        ([keyword, expectedProps]) => {
          const dagStyle = bindings.get(keyword);
          if (!dagStyle?.styleTags.length && !dagStyle?.styleProperties.size)
            return false;

          // Collect all properties from this keyword's style tags and inline properties
          const collectedProperties = new Set([
            ...Array.from(dagStyle.styleProperties.keys()),
            ...dagStyle.styleTags.flatMap((styleTag) => {
              const properties = flattenedStyles.get(styleTag.join("."));
              return properties ? Array.from(properties.keys()) : [];
            }),
          ]);

          // Check if all expected properties are present
          return expectedProps.isSubsetOf(collectedProperties);
        },
      );
    },
  },
];

export const styleModule = {
  name: "Style",
  puzzlets: stylePuzzlets,
};
