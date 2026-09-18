import * as fs from 'fs';
import * as path from 'path';
import {
  DependencyGraph,
  GraphEdge,
  GraphNode,
  RuntimeTraceEntry,
  UnresolvedCallSite
} from './types';
import { BackendScanResult } from '../../scanner/src/backendScanner';
import { FrontendScanResult } from '../../scanner/src/frontendScanner';
import { RouteMatchResult } from '../../scanner/src/routeMatcher';

export class GraphBuilder {
  public buildGraph(
    rootPath: string,
    frontendScan: FrontendScanResult,
    backendScan: BackendScanResult,
    routeMatch: RouteMatchResult,
    runtimeTraces: RuntimeTraceEntry[] = []
  ): DependencyGraph {
    const nodesMap = new Map<string, GraphNode>();
    const edgesMap = new Map<string, GraphEdge>();

    // 1. Add all nodes from backend and frontend
    for (const node of backendScan.nodes) {
      nodesMap.set(node.id, node);
    }
    for (const node of frontendScan.nodes) {
      nodesMap.set(node.id, node);
    }

    // 2. Add Component -> Route edges from RouteMatcher
    for (const edge of routeMatch.matchedEdges) {
      edgesMap.set(edge.id, edge);
    }

    // 3. Add Component -> Subcomponent edges
    for (const comp of frontendScan.components) {
      for (const sub of comp.subComponentsUsed) {
        const subId = `component:${sub}`;
        if (nodesMap.has(subId)) {
          const edgeId = `edge:component:${comp.name}->component:${sub}`;
          edgesMap.set(edgeId, {
            id: edgeId,
            source: `component:${comp.name}`,
            target: subId,
            type: 'contains',
            file: comp.file,
            line: comp.line,
            confidence: 'high',
            isTryCatchGuarded: true,
            notes: `<${comp.name}> renders <${sub} />`
          });
        }
      }
    }

    // 4. Add Route -> Service function edges
    for (const route of backendScan.routes) {
      const routeId = `route:${route.method.toUpperCase()}:${route.fullPath}`;
      for (const svcCall of route.servicesCalled) {
        const svcId = `service:${svcCall.serviceName}:${svcCall.methodName}`;
        if (nodesMap.has(svcId)) {
          const edgeId = `edge:${routeId}->${svcId}`;
          edgesMap.set(edgeId, {
            id: edgeId,
            source: routeId,
            target: svcId,
            type: 'serves',
            file: route.file,
            line: svcCall.line || route.line,
            confidence: 'high',
            notes: `Route handler ${route.handlerName || ''} invokes ${svcCall.serviceName}.${svcCall.methodName}()`
          });
        }
      }
    }

    // 5. Add Service -> DB access edges and Service -> Service edges
    for (const svc of backendScan.services) {
      const svcId = `service:${svc.name}:${svc.methodName}`;

      // Service -> DB
      for (const dbCall of svc.dbCalls) {
        const dbId = `db:${dbCall.dbAccessName}`;
        if (nodesMap.has(dbId)) {
          const edgeId = `edge:${svcId}->${dbId}`;
          edgesMap.set(edgeId, {
            id: edgeId,
            source: svcId,
            target: dbId,
            type: 'queries',
            file: svc.file,
            line: dbCall.line,
            confidence: 'high',
            notes: `${svc.name}.${svc.methodName}() executes ${dbCall.dbAccessName}`
          });
        }
      }

      // Service -> Other Service
      for (const otherSvc of svc.otherServicesCalled) {
        const otherId = `service:${otherSvc.serviceName}:${otherSvc.methodName}`;
        if (nodesMap.has(otherId)) {
          const edgeId = `edge:${svcId}->${otherId}`;
          edgesMap.set(edgeId, {
            id: edgeId,
            source: svcId,
            target: otherId,
            type: 'calls',
            file: svc.file,
            line: otherSvc.line,
            confidence: 'high',
            notes: `Inter-service call: ${svc.name}.${svc.methodName}() invokes ${otherSvc.serviceName}.${otherSvc.methodName}()`
          });
        }
      }
    }

    // 6. Cross-reference with Runtime Traces
    const confirmedRoutes = new Set<string>();
    const confirmedDbCalls = new Set<string>();

    for (const trace of runtimeTraces) {
      confirmedRoutes.add(`${trace.method.toUpperCase()} ${trace.path}`);
      confirmedRoutes.add(`${trace.method.toUpperCase()} ${trace.route}`);
      for (const db of trace.dbCalls) {
        confirmedDbCalls.add(db.callName);
      }
    }

    let confirmedCount = 0;
    let unconfirmedCount = 0;

    for (const edge of edgesMap.values()) {
      if (runtimeTraces.length === 0) {
        edge.runtimeStatus = 'unconfirmed';
        unconfirmedCount++;
      } else {
        let isConfirmed = false;
        // Check if route was hit
        if (edge.target.startsWith('route:')) {
          const routeNode = nodesMap.get(edge.target);
          if (routeNode && (confirmedRoutes.has(routeNode.name) || confirmedRoutes.has(routeNode.routePath || ''))) {
            isConfirmed = true;
          }
        } else if (edge.target.startsWith('db:')) {
          const dbNode = nodesMap.get(edge.target);
          if (dbNode && confirmedDbCalls.has(dbNode.name)) {
            isConfirmed = true;
          }
        } else if (edge.source.startsWith('route:')) {
          const routeNode = nodesMap.get(edge.source);
          if (routeNode && (confirmedRoutes.has(routeNode.name) || confirmedRoutes.has(routeNode.routePath || ''))) {
            isConfirmed = true;
          }
        } else {
          isConfirmed = true; // Component/subcomponent or internal calls
        }

        if (isConfirmed) {
          edge.runtimeStatus = 'confirmed';
          confirmedCount++;
        } else {
          edge.runtimeStatus = 'unconfirmed';
          unconfirmedCount++;
        }
      }
    }

    const nodes = Array.from(nodesMap.values());
    const edges = Array.from(edgesMap.values());

    const totalComponents = nodes.filter(n => n.type === 'component').length;
    const totalRoutes = nodes.filter(n => n.type === 'route').length;
    const totalServices = nodes.filter(n => n.type === 'service-function').length;
    const totalDbAccessPoints = nodes.filter(n => n.type === 'db-access-point').length;

    const highConfidence = edges.filter(e => e.confidence === 'high').length;
    const mediumConfidence = edges.filter(e => e.confidence === 'medium').length;
    const lowConfidence = edges.filter(e => e.confidence === 'low').length;

    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      rootPath,
      nodes,
      edges,
      summary: {
        totalComponents,
        totalRoutes,
        totalServices,
        totalDbAccessPoints,
        totalEdges: edges.length,
        highConfidenceEdges: highConfidence,
        mediumConfidenceEdges: mediumConfidence,
        lowConfidenceEdges: lowConfidence,
        confirmedEdges: confirmedCount,
        unconfirmedEdges: unconfirmedCount,
        unresolvedCallSites: routeMatch.unresolvedCallSites.length,
        matchRatePercentage: routeMatch.metrics.matchRatePercentage
      }
    };
  }

  public saveGraphFiles(
    outputDir: string,
    graph: DependencyGraph,
    unresolved: UnresolvedCallSite[]
  ): { graphPath: string; unresolvedPath: string } {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const graphPath = path.join(outputDir, 'graph.json');
    const unresolvedPath = path.join(outputDir, 'unresolved.json');

    fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2), 'utf-8');
    fs.writeFileSync(unresolvedPath, JSON.stringify(unresolved, null, 2), 'utf-8');

    return { graphPath, unresolvedPath };
  }
}
