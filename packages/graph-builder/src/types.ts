// Core types for GraphFlow

export type NodeType = 'component' | 'route' | 'service-function' | 'db-access-point';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type NodeStatus = 'Safe' | 'Degraded' | 'Affected' | 'Failed';

export type EdgeRuntimeStatus = 'confirmed' | 'unconfirmed' | 'runtime-only';

export interface GraphNode {
  id: string;
  name: string;
  label: string;
  type: NodeType;
  file: string;
  line: number;
  endLine?: number;
  handlerName?: string;
  httpMethod?: string;
  routePath?: string;
  responseShape?: Record<string, string>; // Field name -> type (e.g. { userId: 'string', email: 'string' })
  hasTryCatch?: boolean;
  codeSnippet?: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string; // Caller ID (e.g. component:UserProfile)
  target: string; // Callee ID (e.g. route:GET:/api/users/:id)
  type: 'calls' | 'serves' | 'queries' | 'contains';
  file: string;
  line: number;
  confidence: ConfidenceLevel;
  callExpression?: string;
  isTryCatchGuarded?: boolean;
  runtimeStatus?: EdgeRuntimeStatus;
  lastSeenTimestamp?: string;
  destructuredFields?: string[];
  notes?: string;
}

export interface DependencyGraph {
  version: string;
  timestamp: string;
  rootPath: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    totalComponents: number;
    totalRoutes: number;
    totalServices: number;
    totalDbAccessPoints: number;
    totalEdges: number;
    highConfidenceEdges: number;
    mediumConfidenceEdges: number;
    lowConfidenceEdges: number;
    confirmedEdges: number;
    unconfirmedEdges: number;
    unresolvedCallSites: number;
    matchRatePercentage: number;
  };
}

export interface UnresolvedCallSite {
  file: string;
  line: number;
  callerComponent: string;
  expression: string;
  reason: string;
  suggestedPattern?: string;
}

export interface RuntimeTraceEntry {
  traceId: string;
  timestamp: string;
  method: string;
  route: string;
  path: string;
  statusCode: number;
  durationMs: number;
  dbCalls: Array<{
    callName: string;
    durationMs?: number;
    meta?: any;
  }>;
}

export interface SimulationScenario {
  id: string;
  name: string;
  targetNodeId: string;
  action: 'remove_route' | 'service_fail' | 'db_fail' | 'dependency_removed' | 'latency_increase' | 'field_rename';
  latencyMs?: number;
  field?: string;
  newField?: string;
  description?: string;
}

export interface FieldBlameInfo {
  field: string;
  line: number;
  confidence: ConfidenceLevel;
  explanation: string;
}

export interface SimulationNodeResult {
  nodeId: string;
  node: GraphNode;
  status: NodeStatus;
  reason: string;
  propagationPath: string[]; // List of node IDs showing the propagation chain
  edgePath: GraphEdge[];
  fieldBlame?: FieldBlameInfo;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  timestamp: string;
  totalNodes: number;
  statusCounts: {
    Safe: number;
    Degraded: number;
    Affected: number;
    Failed: number;
  };
  affectedComponentCount: number;
  maxPropagationDepth: number;
  nodes: Record<string, SimulationNodeResult>;
}

export interface EvaluationScenarioResult {
  scenarioId: string;
  scenarioName: string;
  truePositives: string[];
  falsePositives: string[];
  falseNegatives: string[];
  trueNegatives: string[];
  precision: number;
  recall: number;
  f1Score: number;
  executionTimeMs: number;
  statusAccuracy: number;
}

export interface EvaluationSummary {
  timestamp: string;
  totalScenarios: number;
  overallPrecision: number;
  overallRecall: number;
  overallF1Score: number;
  meanExecutionTimeMs: number;
  manualBaselineTimeMs: number;
  speedupFactor: number;
  scenarioResults: EvaluationScenarioResult[];
}
