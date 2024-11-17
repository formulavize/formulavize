import { RecipeTreeNode } from "./ast";
import { Dag } from "./dag";

export class Compilation {
  // keep intermediate states for debugging
  private source: string;
  private ast: RecipeTreeNode;
  private dag: Dag;

  constructor(source: string, ast: RecipeTreeNode, dag: Dag) {
    this.source = source;
    this.ast = ast;
    this.dag = dag;
  }

  get Source(): string {
    return this.source;
  }

  get AST(): RecipeTreeNode {
    return this.ast;
  }

  get DAG(): Dag {
    return this.dag;
  }
}
