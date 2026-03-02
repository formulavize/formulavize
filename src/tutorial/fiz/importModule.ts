import { Puzzlet } from "../lesson";
import { normal, fast } from "../animationHelpers";
import { NodeType, ImportTreeNode } from "src/compiler/ast";

const importBaseUrl = "https://formulavize.github.io/fiz-tutorial-imports/";
const antUrl = `${importBaseUrl}ant.fiz`;
const flyingUrl = `${importBaseUrl}flying.fiz`;
const byobUrl = `${importBaseUrl}example.fiz`;

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
    successCondition: (compilation) => {
      return compilation.DAG.UsedImports.has(antUrl);
    },
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
    successCondition: (compilation) => {
      const hasImport = compilation.DAG.UsedImports.has(flyingUrl);
      const importStmts = compilation.AST.Statements.filter(
        (stmt) => stmt.Type === NodeType.Import,
      ) as ImportTreeNode[];
      const hasNamespacedFlyingImport = importStmts.some(
        (stmt) => stmt.ImportLocation === flyingUrl && stmt.ImportName != null,
      );
      return hasImport && hasNamespacedFlyingImport;
    },
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
    successCondition: (compilation) => {
      const hasImport = compilation.DAG.UsedImports.has(byobUrl);
      const nodeList = compilation.DAG.getNodeList();
      const nodeNames = new Set(nodeList.map((node) => node.name));
      return (
        hasImport &&
        ["add", "join", "freeze"].every((name) => nodeNames.has(name))
      );
    },
  },
];

export const importModule = {
  name: "Imports",
  puzzlets: importPuzzlets,
};
