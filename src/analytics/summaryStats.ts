export interface DagStructuralStats {
  nodeCount: number;
  edgeCount: number;
  maxNestingDepth: number;
  totalChildDags: number;
  maxInDegree: number;
  maxOutDegree: number;
  avgInDegree: number;
  avgOutDegree: number;
}

export interface NamespaceStats {
  namespaceCount: number;
  maxNamespaceDepth: number;
  avgNamespaceDepth: number;
}

export interface StylingStats {
  totalStyleTagCount: number;
  totalStylePropertyCount: number;
  avgStyleTagsPerElement: number;
  avgStylePropertiesPerElement: number;
  styleBindingCount: number;
  inlineStyleCount: number;
  taggedStyleCount: number;
}

export interface VariableStats {
  variableDeclarationCount: number;
  styleVariableDeclarationCount: number;
  qualifiedStyleUsageCount: number;
  maxQualifiedStylePartLength: number;
  avgQualifiedStylePartLength: number;
}

export interface ImportStats {
  importCount: number;
  uniqueImportCount: number;
}

export interface NamingStats {
  namedEdgeCount: number;
  unnamedEdgeCount: number;
  avgNodeNameLength: number;
  avgEdgeNameLength: number;
}

export class SummaryStats {
  structural: DagStructuralStats;
  namespace: NamespaceStats;
  styling: StylingStats;
  variable: VariableStats;
  imports: ImportStats;
  naming: NamingStats;

  constructor(
    structural: DagStructuralStats,
    namespace: NamespaceStats,
    styling: StylingStats,
    variable: VariableStats,
    imports: ImportStats,
    naming: NamingStats,
  ) {
    this.structural = structural;
    this.namespace = namespace;
    this.styling = styling;
    this.variable = variable;
    this.imports = imports;
    this.naming = naming;
  }

  toJSON(): Record<string, unknown> {
    return {
      structural: this.structural,
      namespace: this.namespace,
      styling: this.styling,
      variable: this.variable,
      imports: this.imports,
      naming: this.naming,
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}
