import {
  DependencyGraph,
  EvaluationSummary,
  GraphEdge,
  GraphNode,
  NodeStatus,
  SimulationResult,
  SimulationScenario,
  UnresolvedCallSite
} from '../../packages/graph-builder/src/types';

export interface AppState {
  graph: DependencyGraph | null;
  unresolved: UnresolvedCallSite[];
  activeSimulation: SimulationResult | null;
  activeScenario: SimulationScenario | null;
  selectedNodeId: string | null;
  selectedNode: GraphNode | null;
  evaluationSummary: EvaluationSummary | null;
  evaluationMarkdown: string | null;
  isLoading: boolean;
  activeTab: 'graph' | 'compare' | 'evaluation' | 'pr-comment' | 'runtime' | 'unresolved';
}
