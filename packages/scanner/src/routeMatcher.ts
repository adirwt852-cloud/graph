import { BackendRouteInfo } from './backendScanner';
import { FrontendCallSite } from './frontendScanner';
import { ConfidenceLevel, GraphEdge, UnresolvedCallSite } from '../../graph-builder/src/types';

export interface RouteMatchResult {
  matchedEdges: GraphEdge[];
  unresolvedCallSites: UnresolvedCallSite[];
  metrics: {
    totalCallSites: number;
    matchedCount: number;
    unresolvedCount: number;
    matchRatePercentage: number;
    highConfidenceCount: number;
    mediumConfidenceCount: number;
    lowConfidenceCount: number;
  };
}

export class RouteMatcher {
  public match(callSites: FrontendCallSite[], routes: BackendRouteInfo[]): RouteMatchResult {
    const matchedEdges: GraphEdge[] = [];
    const unresolvedCallSites: UnresolvedCallSite[] = [];

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const call of callSites) {
      const match = this.findBestRouteMatch(call, routes);

      if (match) {
        if (match.confidence === 'high') highCount++;
        else if (match.confidence === 'medium') mediumCount++;
        else lowCount++;

        matchedEdges.push({
          id: `edge:${call.callerComponent}->${match.route.method.toUpperCase()}:${match.route.fullPath}`,
          source: `component:${call.callerComponent}`,
          target: `route:${match.route.method.toUpperCase()}:${match.route.fullPath}`,
          type: 'calls',
          file: call.file,
          line: call.line,
          confidence: match.confidence,
          callExpression: call.expression,
          isTryCatchGuarded: call.isTryCatchGuarded,
          destructuredFields: call.destructuredFields,
          notes: match.reason
        });
      } else {
        unresolvedCallSites.push({
          file: call.file,
          line: call.line,
          callerComponent: call.callerComponent,
          expression: call.expression,
          reason: `No backend route matched pattern '${call.normalizedPattern || call.expression}' for HTTP ${call.httpMethod}`,
          suggestedPattern: call.normalizedPattern
        });
      }
    }

    const totalCallSites = callSites.length;
    const matchedCount = matchedEdges.length;
    const matchRatePercentage = totalCallSites > 0 ? Number(((matchedCount / totalCallSites) * 100).toFixed(1)) : 100;

    return {
      matchedEdges,
      unresolvedCallSites,
      metrics: {
        totalCallSites,
        matchedCount,
        unresolvedCount: unresolvedCallSites.length,
        matchRatePercentage,
        highConfidenceCount: highCount,
        mediumConfidenceCount: mediumCount,
        lowConfidenceCount: lowCount
      }
    };
  }

  private findBestRouteMatch(
    call: FrontendCallSite,
    routes: BackendRouteInfo[]
  ): { route: BackendRouteInfo; confidence: ConfidenceLevel; reason: string } | null {
    const callMethod = (call.httpMethod || 'GET').toUpperCase();
    const targetPattern = this.cleanPattern(call.normalizedPattern || call.urlLiteral || '');

    // 1. Exact path and method match
    for (const route of routes) {
      if (route.method.toUpperCase() === callMethod) {
        if (this.cleanPattern(route.fullPath) === targetPattern) {
          return {
            route,
            confidence: 'high',
            reason: `Exact route match: ${callMethod} ${route.fullPath}`
          };
        }
      }
    }

    // 2. Parametric matching (e.g. /api/users/:param matches /api/users/:id or /api/users/:userId)
    for (const route of routes) {
      if (route.method.toUpperCase() === callMethod) {
        if (this.matchParametricPatterns(targetPattern, this.cleanPattern(route.fullPath))) {
          return {
            route,
            confidence: 'high',
            reason: `Matched parameterized path: ${call.normalizedPattern} -> ${route.fullPath}`
          };
        }
      }
    }

    // 3. Normalized without '/api' prefix tolerance or slight variations
    for (const route of routes) {
      if (route.method.toUpperCase() === callMethod) {
        const p1 = this.stripApiPrefix(targetPattern);
        const p2 = this.stripApiPrefix(this.cleanPattern(route.fullPath));
        if (p1 === p2 || this.matchParametricPatterns(p1, p2)) {
          return {
            route,
            confidence: 'medium',
            reason: `Matched route with normalized API prefix: ${route.fullPath}`
          };
        }
      }
    }

    // 4. Method mismatch or fuzzy match
    for (const route of routes) {
      if (this.cleanPattern(route.fullPath) === targetPattern || this.matchParametricPatterns(targetPattern, this.cleanPattern(route.fullPath))) {
        return {
          route,
          confidence: 'low',
          reason: `Matched path ${route.fullPath} but methods differ (caller assumed ${callMethod}, route is ${route.method.toUpperCase()})`
        };
      }
    }

    return null;
  }

  private cleanPattern(p: string): string {
    return p.trim().replace(/\/+/g, '/').replace(/\/$/, '');
  }

  private stripApiPrefix(p: string): string {
    return p.replace(/^\/api/, '');
  }

  private matchParametricPatterns(pattern1: string, pattern2: string): boolean {
    const segs1 = pattern1.split('/').filter(Boolean);
    const segs2 = pattern2.split('/').filter(Boolean);

    if (segs1.length !== segs2.length) return false;

    for (let i = 0; i < segs1.length; i++) {
      const s1 = segs1[i];
      const s2 = segs2[i];

      const isParam1 = s1.startsWith(':') || s1.startsWith('$') || s1 === ':param';
      const isParam2 = s2.startsWith(':') || s2.startsWith('$') || s2 === ':param';

      if (isParam1 || isParam2) {
        continue; // wildcards match
      }

      if (s1 !== s2) {
        return false;
      }
    }

    return true;
  }
}
