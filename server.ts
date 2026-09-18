import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { FrontendScanner } from './packages/scanner/src/frontendScanner';
import { BackendScanner } from './packages/scanner/src/backendScanner';
import { RouteMatcher } from './packages/scanner/src/routeMatcher';
import { GraphBuilder } from './packages/graph-builder/src/graphBuilder';
import { WhatIfSimulator } from './packages/simulator/src/simulator';
import { EvaluationHarness } from './packages/evaluation/src/evaluationHarness';
import { HtmlReporter } from './packages/reporter/src/htmlReporter';
import { PrCommentFormatter } from './packages/reporter/src/prCommentFormatter';
import { RuntimeAgent } from './packages/runtime-agent/src/runtimeAgent';
import { DependencyGraph, RuntimeTraceEntry } from './packages/graph-builder/src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize runtime agent middleware
  RuntimeAgent.initialize({ outputPath: './dist/graphflow/runtime-trace.json' });
  app.use(RuntimeAgent.getMiddleware());

  // Cache initial graph in memory
  let cachedGraph: DependencyGraph | null = null;
  let cachedUnresolved: any[] = [];

  function getOrBuildGraph(): { graph: DependencyGraph; unresolved: any[] } {
    if (cachedGraph) return { graph: cachedGraph, unresolved: cachedUnresolved };

    const feScanner = new FrontendScanner();
    const beScanner = new BackendScanner();
    const matcher = new RouteMatcher();
    const builder = new GraphBuilder();

    const feResult = feScanner.scanDirectory(path.resolve('./fixtures/standard/frontend'));
    const beResult = beScanner.scanDirectory(path.resolve('./fixtures/standard/backend'));
    const matchResult = matcher.match(feResult.components.flatMap(c => c.callSites), beResult.routes);

    // Initial synthetic traces for runtime verification
    const traces: RuntimeTraceEntry[] = [
      {
        traceId: 'trc_101',
        timestamp: new Date().toISOString(),
        method: 'GET',
        route: '/api/users/:id',
        path: '/api/users/usr_101',
        statusCode: 200,
        durationMs: 12,
        dbCalls: [{ callName: 'db.users.findOne', durationMs: 4 }]
      },
      {
        traceId: 'trc_102',
        timestamp: new Date().toISOString(),
        method: 'GET',
        route: '/api/users',
        path: '/api/users',
        statusCode: 200,
        durationMs: 18,
        dbCalls: [{ callName: 'db.users.find', durationMs: 6 }]
      },
      {
        traceId: 'trc_103',
        timestamp: new Date().toISOString(),
        method: 'POST',
        route: '/api/orders/checkout',
        path: '/api/orders/checkout',
        statusCode: 200,
        durationMs: 42,
        dbCalls: [
          { callName: 'db.users.findOne', durationMs: 5 },
          { callName: 'db.orders.insertOne', durationMs: 10 }
        ]
      }
    ];

    cachedGraph = builder.buildGraph(process.cwd(), feResult, beResult, matchResult, traces);
    cachedUnresolved = matchResult.unresolvedCallSites;

    return { graph: cachedGraph, unresolved: cachedUnresolved };
  }

  // API 1: Scan full stack
  app.get('/api/scan', (req: Request, res: Response) => {
    try {
      const { graph, unresolved } = getOrBuildGraph();
      res.json({
        success: true,
        graph,
        unresolved
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API 2: Run simulation
  app.post('/api/simulate', (req: Request, res: Response) => {
    try {
      const { graph } = getOrBuildGraph();
      const { targetNodeId, action, field, newField, latencyMs, name } = req.body;

      const simulator = new WhatIfSimulator();
      const result = simulator.runSimulation(graph, {
        id: `sim_${Date.now()}`,
        name: name || `Simulation on ${targetNodeId}`,
        targetNodeId,
        action,
        field,
        newField,
        latencyMs: latencyMs ? Number(latencyMs) : undefined
      });

      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API 3: Compare two scenarios
  app.post('/api/compare', (req: Request, res: Response) => {
    try {
      const { graph } = getOrBuildGraph();
      const { scenarioA, scenarioB } = req.body;

      const simulator = new WhatIfSimulator();
      const resA = simulator.runSimulation(graph, scenarioA);
      const resB = simulator.runSimulation(graph, scenarioB);

      const comparison = simulator.compareScenarios(resA, resB);
      res.json({ success: true, comparison });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API 4: Run evaluation harness
  app.get('/api/evaluate', (req: Request, res: Response) => {
    try {
      const { graph } = getOrBuildGraph();
      const groundTruthPath = path.resolve('./fixtures/ground-truth.json');
      const summary = EvaluationHarness.runEvaluation(graph, groundTruthPath);
      const markdown = EvaluationHarness.generateResultsMarkdown(summary);

      res.json({ success: true, summary, markdown });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API 5: Generate PR Comment preview
  app.post('/api/pr-comment', (req: Request, res: Response) => {
    try {
      const { graph } = getOrBuildGraph();
      const { scenario, confidenceThreshold } = req.body;

      const simulator = new WhatIfSimulator();
      const simResult = simulator.runSimulation(graph, scenario);
      const comment = PrCommentFormatter.formatPrComment(simResult, {
        confidenceThreshold: confidenceThreshold || 'medium',
        reportArtifactUrl: 'https://github.com/org/repo/actions/runs/12345'
      });

      res.json({ success: true, comment, simResult });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API 6: Standalone HTML report export
  app.post('/api/export-html', (req: Request, res: Response) => {
    try {
      const { graph } = getOrBuildGraph();
      const { scenario } = req.body;

      const simulator = new WhatIfSimulator();
      const simResult = simulator.runSimulation(graph, scenario);
      const html = HtmlReporter.generateHtmlReport(graph, simResult);

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GraphFlow server running on http://localhost:${PORT}`);
  });
}

startServer();
