import * as fs from 'fs';
import * as path from 'path';
import { FrontendScanner } from '../../scanner/src/frontendScanner';
import { BackendScanner } from '../../scanner/src/backendScanner';
import { RouteMatcher } from '../../scanner/src/routeMatcher';
import { GraphBuilder } from '../../graph-builder/src/graphBuilder';
import { WhatIfSimulator } from '../../simulator/src/simulator';
import { PrCommentFormatter } from '../../reporter/src/prCommentFormatter';
import { ConfidenceLevel, DependencyGraph } from '../../graph-builder/src/types';

export async function runAction() {
  const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;
  const confidenceThreshold = (process.env.INPUT_CONFIDENCE_THRESHOLD || 'medium') as ConfidenceLevel;
  const frontendDir = process.env.INPUT_FRONTEND_DIR || './fixtures/standard/frontend';
  const backendDir = process.env.INPUT_BACKEND_DIR || './fixtures/standard/backend';

  console.log('⚡ GraphFlow GitHub Action running...');

  // 1. Scan current PR codebase
  const fe = new FrontendScanner().scanDirectory(path.resolve(frontendDir));
  const be = new BackendScanner().scanDirectory(path.resolve(backendDir));
  const match = new RouteMatcher().match(fe.components.flatMap(c => c.callSites), be.routes);
  const currentGraph = new GraphBuilder().buildGraph(process.cwd(), fe, be, match);

  // 2. Diff against base branch graph (if available)
  const baseGraphPath = path.resolve('.graphflow/base-graph.json');
  let changedNodes: string[] = [];

  if (fs.existsSync(baseGraphPath)) {
    try {
      const baseGraph: DependencyGraph = JSON.parse(fs.readFileSync(baseGraphPath, 'utf-8'));
      const baseNodeIds = new Set(baseGraph.nodes.map(n => n.id));
      const currentNodeIds = new Set(currentGraph.nodes.map(n => n.id));

      // Removed nodes in PR
      for (const id of baseNodeIds) {
        if (!currentNodeIds.has(id)) {
          changedNodes.push(id);
        }
      }
    } catch (e) {
      // Fallback
    }
  }

  // If no base diff found, simulate first route / sample node
  if (changedNodes.length === 0 && currentGraph.nodes.length > 0) {
    const sampleTarget = currentGraph.nodes.find(n => n.type === 'route') || currentGraph.nodes[0];
    changedNodes.push(sampleTarget.id);
  }

  // 3. Run Simulation on Changed Nodes
  const simulator = new WhatIfSimulator();
  const simResult = simulator.runSimulation(currentGraph, {
    id: 'pr_simulation',
    name: `PR Change on ${changedNodes.join(', ')}`,
    targetNodeId: changedNodes[0],
    action: 'remove_route'
  });

  // 4. Format PR Comment with noise suppression
  const commentMarkdown = PrCommentFormatter.formatPrComment(simResult, {
    confidenceThreshold,
    reportArtifactUrl: 'https://github.com/org/repo/actions/runs/latest'
  });

  if (!commentMarkdown) {
    console.log('✅ No blast radius issues detected above confidence threshold. Noise control suppressed PR comment.');
    return;
  }

  console.log('📢 Blast Radius Comment Formatted:');
  console.log(commentMarkdown);

  // Save comment artifact for CI pipeline
  fs.mkdirSync('./dist/graphflow', { recursive: true });
  fs.writeFileSync('./dist/graphflow/pr-comment.md', commentMarkdown, 'utf-8');
}

if (process.env.NODE_ENV !== 'test') {
  runAction().catch(err => {
    console.error('Error executing GraphFlow GitHub Action:', err);
  });
}
