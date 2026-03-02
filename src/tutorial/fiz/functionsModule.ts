import { Puzzlet } from "../lesson";
import { Compilation } from "src/compiler/compilation";
import { normal } from "../animationHelpers";
import { getInDegree, getOutDegree } from "../winCheckHelpers";

const functionsPuzzlets: Puzzlet[] = [
  {
    name: "Getting Edgy",
    instructions: [
      normal("f() is a function.\n"),
      normal("Functions consist of a word followed by ( ).\n"),
      normal("Functions are visualized as nodes.\n"),
      normal("Functions can be input to other functions.\n"),
      normal("Put another function between the ( )."),
    ],
    examples: [],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getEdgeList().length > 0;
    },
  },
  {
    name: "Double Edged",
    instructions: [
      normal("Arguments to functions are visualized as edges.\n"),
      normal("Functions can also take multiple comma separated inputs.\n"),
      normal("Add a ',' and then another function in the outermost ( )."),
    ],
    examples: [],
    successCondition: (compilation: Compilation) => {
      const edgeList = compilation.DAG.getEdgeList();
      return compilation.DAG.getNodeList().some(
        (node) => getInDegree(node.id, edgeList) >= 2,
      );
    },
  },
  {
    name: "Compose Yourself",
    instructions: [
      normal("Functions can also be arbitrarily nested.\n"),
      normal("Add another function inside an innermost ( )."),
    ],
    examples: [],
    successCondition: (compilation: Compilation) => {
      const edgeList = compilation.DAG.getEdgeList();
      return compilation.DAG.getNodeList().some((node) => {
        const inDegree = getInDegree(node.id, edgeList);
        const outDegree = getOutDegree(node.id, edgeList);
        return inDegree >= 1 && outDegree >= 1;
      });
    },
  },
];

export const functionsModule = {
  name: "Functions",
  puzzlets: functionsPuzzlets,
};
