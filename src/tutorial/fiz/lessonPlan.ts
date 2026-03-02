import { Lesson, Puzzlet } from "../lesson";
import { Compilation } from "src/compiler/compilation";
import { normal, fast, slow } from "../animationHelpers";

import { functionsModule } from "./functionsModule";
import { assignmentModule } from "./assignmentModule";
import { styleModule } from "./styleModule";
import { namespacesModule } from "./namespacesModule";
import { importModule } from "./importModule";

export function createFizLesson(): Lesson {
  // Intro module
  const introPuzzlet: Puzzlet = {
    name: "Let's get func-y!",
    instructions: [
      normal("Welcome to an interactive fiz language tutorial!\n"),
      normal("Start by uncommenting the following line (remove the '//'):"),
    ],
    examples: [fast("// f()")],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().length > 0;
    },
  };
  const introModule = {
    name: "Intro",
    puzzlets: [introPuzzlet],
  };

  // Outro module
  const outroPuzzlet: Puzzlet = {
    name: "The End of the Beginning",
    instructions: [
      slow("Congratulations! "),
      normal("You completed the tutorial!\n"),
      normal("Uncomment the exit() function to exit this tutorial."),
    ],
    examples: [fast("// exit()")],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().some((node) => node.name === "exit");
    },
  };
  const outroModule = {
    name: "Outro",
    puzzlets: [outroPuzzlet],
  };

  return new Lesson("fiz Tutorial", [
    introModule,
    functionsModule,
    assignmentModule,
    styleModule,
    namespacesModule,
    importModule,
    outroModule,
  ]);
}
