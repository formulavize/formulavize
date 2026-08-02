import { Puzzlet, SuccessCriterion } from "../lesson";
import { normal, fast } from "../animationHelpers";
import { NodeType, ImportTreeNode } from "src/compiler/ast";

const importBaseUrl = "https://formulavize.github.io/fiz-tutorial-imports/";
const antUrl = `${importBaseUrl}ant.fiz`;
const flyingUrl = `${importBaseUrl}flying.fiz`;
const byobUrl = `${importBaseUrl}example.fiz`;

type PuzzletCompilation = Parameters<SuccessCriterion["check"]>[0];

const createHasFunctionNodeCheck = (functionName: string) => {
  return (compilation: PuzzletCompilation) => {
    const nodeNames = new Set(
      compilation.DAG.getNodeList().map((node) => node.name),
    );
    return nodeNames.has(functionName);
  };
};

const importPuzzlets: Puzzlet[] = [
  {
    name: "Import Ant",
    instructions: [
      normal("Importing allows you to use fiz from other files.\n"),
      normal('An import statement consists of @ followed by a "url".\n'),
      normal(`@ "${antUrl}"\n`),
      normal("is an example import statement.\n"),
      normal("Imports must end in a .fiz suffix.\n"),
      normal("Uncomment the import statement below."),
    ],
    examples: [fast(`// @ "${antUrl}"`)],
    clearEditorOnStart: true,
    successCriteria: [
      {
        description: "Import the ant.fiz file",
        check: (compilation) => compilation.DAG.UsedImports.has(antUrl),
      },
    ],
  },
  {
    name: "Import Antigravity",
    instructions: [
      normal("Multiple files can be imported.\n"),
      normal("Imports themselves can import multiple dependencies.\n"),
      normal("To visually separate import contents, use namespaces.\n"),
      normal("Put a word at the front of the import statement to put\n"),
      normal("the imported content in a namespace.\n"),
      normal('ns @ "url.fiz" is an example of a namespaced import.\n'),
      normal("Add a namespace to the flying.fiz import below."),
    ],
    examples: [fast(`@ "${flyingUrl}"`)],
    successCriteria: [
      {
        description: "Import the flying.fiz file",
        check: (compilation) => compilation.DAG.UsedImports.has(flyingUrl),
      },
      {
        description: "Import the flying.fiz file into a namespace",
        check: (compilation) => {
          const importStmts = compilation.AST.Statements.filter(
            (stmt) => stmt.Type === NodeType.Import,
          ) as ImportTreeNode[];
          return importStmts.some(
            (stmt) =>
              stmt.ImportLocation === flyingUrl && stmt.ImportName != null,
          );
        },
      },
    ],
  },
  {
    name: "BYOB (Bring Your Own Bindings)",
    instructions: [
      normal("Some imports only contain styles and keyword bindings.\n"),
      normal("You can re-use these style definitions by importing them\n"),
      normal("saving you from redefining them.\n"),
      normal("Importing is useful for domains with standardized symbols.\n"),
      normal("Uncomment the function calls below to see them in use."),
    ],
    examples: [
      fast(`@ "${byobUrl}"\n`),
      fast(`// add()\n`),
      fast(`// join()\n`),
      fast(`// freeze()\n`),
    ],
    successCriteria: [
      {
        description: "Import the example.fiz file",
        check: (compilation) => compilation.DAG.UsedImports.has(byobUrl),
      },
      {
        description: "Create the add function",
        check: createHasFunctionNodeCheck("add"),
      },
      {
        description: "Create the join function",
        check: createHasFunctionNodeCheck("join"),
      },
      {
        description: "Create the freeze function",
        check: createHasFunctionNodeCheck("freeze"),
      },
    ],
  },
];

export const importModule = {
  name: "Imports",
  puzzlets: importPuzzlets,
};
