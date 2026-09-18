import * as path from 'path';
import {
  DependencyGraph,
  GraphEdge,
  GraphNode,
  NodeStatus,
  SimulationNodeResult,
  SimulationResult,
  SimulationScenario
} from '../../graph-builder/src/types';

export class WhatIfSimulator {
  public runSimulation(graph: DependencyGraph, scenario: SimulationScenario): SimulationResult {
    const nodeMap = new Map<string, GraphNode>();
    for (const n of graph.nodes) {
      nodeMap.set(n.id, n);
    }

    // Build reverse adjacency list (Callee -> Callers) to propagate upstream to affected consumers
    const incomingEdges = new Map<string, GraphEdge[]>();
    for (const edge of graph.edges) {
      if (!incomingEdges.has(edge.target)) {
        incomingEdges.set(edge.target, []);
      }
      incomingEdges.get(edge.target)!.push(edge);
    }

    const nodeResults: Record<string, SimulationNodeResult> = {};

    // Initialize all nodes as Safe
    for (const node of graph.nodes) {
      nodeResults[node.id] = {
        nodeId: node.id,
        node,
        status: 'Safe',
        reason: 'Operating normally with no upstream failures detected.',
        propagationPath: [],
        edgePath: []
      };
    }

    // Identify Root Cause Node
    const rootNode = nodeMap.get(scenario.targetNodeId);
    if (!rootNode) {
      return {
        scenario,
        timestamp: new Date().toISOString(),
        totalNodes: graph.nodes.length,
        statusCounts: { Safe: graph.nodes.length, Degraded: 0, Affected: 0, Failed: 0 },
        affectedComponentCount: 0,
        maxPropagationDepth: 0,
        nodes: nodeResults
      };
    }

    // Set Root Node Status based on action
    let rootStatus: NodeStatus = 'Failed';
    let rootReason = '';

    switch (scenario.action) {
      case 'remove_route':
        rootStatus = 'Failed';
        rootReason = `Route ${rootNode.name} was removed or unmounted.`;
        break;
      case 'service_fail':
        rootStatus = 'Failed';
        rootReason = `Service method ${rootNode.name} threw an unhandled exception or failed.`;
        break;
      case 'db_fail':
        rootStatus = 'Failed';
        rootReason = `Database access point ${rootNode.name} failed (connection drop / query error).`;
        break;
      case 'dependency_removed':
        rootStatus = 'Failed';
        rootReason = `Dependency / node ${rootNode.name} was removed from the codebase.`;
        break;
      case 'latency_increase':
        rootStatus = 'Degraded';
        rootReason = `High latency detected on ${rootNode.name} (+${scenario.latencyMs || 2000}ms).`;
        break;
      case 'field_rename':
        rootStatus = 'Affected';
        rootReason = `Response field '${scenario.field}' renamed to '${scenario.newField || 'unknown'}' on ${rootNode.name}.`;
        break;
    }

    nodeResults[rootNode.id] = {
      nodeId: rootNode.id,
      node: rootNode,
      status: rootStatus,
      reason: rootReason,
      propagationPath: [rootNode.id],
      edgePath: []
    };

    // Propagate upstream using BFS
    interface QueueItem {
      nodeId: string;
      currentStatus: NodeStatus;
      chain: string[];
      edgeChain: GraphEdge[];
      depth: number;
    }

    const queue: QueueItem[] = [
      {
        nodeId: rootNode.id,
        currentStatus: rootStatus,
        chain: [rootNode.id],
        edgeChain: [],
        depth: 0
      }
    ];

    const visited = new Set<string>();
    visited.add(rootNode.id);
    let maxPropagationDepth = 0;

    while (queue.length > 0) {
      const { nodeId, currentStatus, chain, edgeChain, depth } = queue.shift()!;
      maxPropagationDepth = Math.max(maxPropagationDepth, depth);

      const callers = incomingEdges.get(nodeId) || [];

      for (const edge of callers) {
        const callerNode = nodeMap.get(edge.source);
        if (!callerNode) continue;

        // Determine caller's downstream status
        let callerStatus: NodeStatus = 'Failed';
        let explanation = '';

        if (scenario.action === 'latency_increase') {
          // Latency cascades as Degraded across callers
          callerStatus = 'Degraded';
          explanation = `${callerNode.name} (line ${edge.line}) degraded due to upstream latency (+${scenario.latencyMs || 2000}ms) from ${chain.map(id => nodeMap.get(id)?.name || id).join(' -> ')}.`;
        } else if (scenario.action === 'field_rename') {
          // Field-level blame tracking
          const field = scenario.field || '';
          const hasFieldBlame = edge.destructuredFields && edge.destructuredFields.includes(field);
          const compMeta = callerNode.metadata?.destructuredFields as string[] | undefined;
          const compHasField = compMeta && compMeta.includes(field);

          if (hasFieldBlame || compHasField) {
            callerStatus = 'Failed';
            explanation = `${callerNode.name} (line ${edge.line}) breaks because it destructures '${field}', which was renamed on ${rootNode.name}.`;
            nodeResults[callerNode.id].fieldBlame = {
              field,
              line: edge.line,
              confidence: 'high',
              explanation
            };
          } else if (edge.type === 'calls' && callerNode.type === 'component') {
            callerStatus = 'Affected';
            explanation = `${callerNode.name} consumes ${rootNode.name}. Response shape changed; verify manually.`;
            nodeResults[callerNode.id].fieldBlame = {
              field,
              line: edge.line,
              confidence: 'medium',
              explanation
            };
          } else {
            // Parent components that simply embed the child without calling the API or destructuring remain Safe
            callerStatus = 'Safe';
          }
        } else {
          // Failure scenario (route, service, or DB outage)
          if (edge.isTryCatchGuarded || callerNode.hasTryCatch) {
            callerStatus = 'Degraded';
            explanation = `${callerNode.name} (${callerNode.file ? path.basename(callerNode.file) : ''}:${edge.line}) is degraded because upstream dependency ${chain.map(id => nodeMap.get(id)?.name || id).join(' -> ')} failed, but the caller gracefully handles failure with try/catch error state.`;
          } else {
            callerStatus = 'Failed';
            explanation = `${callerNode.name} (${callerNode.file ? path.basename(callerNode.file) : ''}:${edge.line}) failed: unhandled dependency failure from ${chain.map(id => nodeMap.get(id)?.name || id).join(' -> ')}.`;
          }
        }

        // Priority logic for existing status: Failed > Affected > Degraded > Safe
        const existingStatus = nodeResults[callerNode.id]?.status || 'Safe';
        const priorityOrder: Record<NodeStatus, number> = { Failed: 4, Affected: 3, Degraded: 2, Safe: 1 };

        if (priorityOrder[callerStatus] >= priorityOrder[existingStatus]) {
          const newChain = [...chain, callerNode.id];
          const newEdgeChain = [...edgeChain, edge];

          nodeResults[callerNode.id] = {
            ...nodeResults[callerNode.id],
            nodeId: callerNode.id,
            node: callerNode,
            status: callerStatus,
            reason: explanation,
            propagationPath: newChain,
            edgePath: newEdgeChain
          };

          queue.push({
            nodeId: callerNode.id,
            currentStatus: callerStatus,
            chain: newChain,
            edgeChain: newEdgeChain,
            depth: depth + 1
          });
        }
      }
    }

    // Count summary metrics
    let safeCount = 0;
    let degradedCount = 0;
    let affectedCount = 0;
    let failedCount = 0;
    let affectedComponents = 0;

    for (const res of Object.values(nodeResults)) {
      if (res.status === 'Safe') safeCount++;
      else if (res.status === 'Degraded') degradedCount++;
      else if (res.status === 'Affected') affectedCount++;
      else if (res.status === 'Failed') failedCount++;

      if (res.node.type === 'component' && res.status !== 'Safe') {
        affectedComponents++;
      }
    }

    return {
      scenario,
      timestamp: new Date().toISOString(),
      totalNodes: graph.nodes.length,
      statusCounts: {
        Safe: safeCount,
        Degraded: degradedCount,
        Affected: affectedCount,
        Failed: failedCount
      },
      affectedComponentCount: affectedComponents,
      maxPropagationDepth,
      nodes: nodeResults
    };
  }

  public compareScenarios(simA: SimulationResult, simB: SimulationResult): {
    scenarioA: SimulationResult;
    scenarioB: SimulationResult;
    diffSummary: {
      affectedComponentsDiff: number; // A - B
      failedNodesDiff: number;
      degradedNodesDiff: number;
      propagationDepthDiff: number;
    };
    nodeDiffTable: Array<{
      nodeId: string;
      name: string;
      type: string;
      statusA: NodeStatus;
      statusB: NodeStatus;
      reasonA: string;
      reasonB: string;
    }>;
  } {
    const allNodeIds = new Set([...Object.keys(simA.nodes), ...Object.keys(simB.nodes)]);
    const nodeDiffTable: any[] = [];

    for (const id of allNodeIds) {
      const resA = simA.nodes[id];
      const resB = simB.nodes[id];
      const node = resA?.node || resB?.node;
      if (resA?.status !== 'Safe' || resB?.status !== 'Safe') {
        nodeDiffTable.push({
          nodeId: id,
          name: node?.name || id,
          type: node?.type || 'unknown',
          statusA: resA?.status || 'Safe',
          statusB: resB?.status || 'Safe',
          reasonA: resA?.reason || 'Unaffected',
          reasonB: resB?.reason || 'Unaffected'
        });
      }
    }

    return {
      scenarioA: simA,
      scenarioB: simB,
      diffSummary: {
        affectedComponentsDiff: simA.affectedComponentCount - simB.affectedComponentCount,
        failedNodesDiff: simA.statusCounts.Failed - simB.statusCounts.Failed,
        degradedNodesDiff: simA.statusCounts.Degraded - simB.statusCounts.Degraded,
        propagationDepthDiff: simA.maxPropagationDepth - simB.maxPropagationDepth
      },
      nodeDiffTable
    };
  }
}
