import { RecipeTreeNode } from "./ast";
import { Dag } from "./dag";
import { CompilationError as Error } from "./compilationErrors";

export class Compilation {
  // keep intermediate states for debugging
  private source: string;
  private ast: RecipeTreeNode;
  private dag: Dag;
  private errors: Error[];

  constructor(source: string, ast: RecipeTreeNode, dag: Dag, errors: Error[]) {
    this.source = source;
    this.ast = ast;
    this.dag = dag;
    this.errors = errors;
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

  get Errors(): Error[] {
    return this.errors;
  }
}
