import React, { useState, useEffect } from 'react';
import { DependencyGraph, GraphNode, NodeStatus, SimulationResult, SimulationScenario, UnresolvedCallSite, EvaluationSummary } from '../packages/graph-builder/src/types';
import { GraphCanvas } from './components/GraphCanvas';
import { NodeInspectorModal } from './components/NodeInspectorModal';
import { SimulationControls } from './components/SimulationControls';
import { ScenarioComparisonModal } from './components/ScenarioComparisonModal';
import { EvaluationDashboard } from './components/EvaluationDashboard';
import { PrCommentSimulator } from './components/PrCommentSimulator';
import { RuntimeTraceView } from './components/RuntimeTraceView';
import { UnresolvedSitesModal } from './components/UnresolvedSitesModal';
import {
  Network,
  Zap,
  GitCompare,
  Award,
  MessageSquare,
  Activity,
  FileCode,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  RotateCw,
  Search
} from 'lucide-react';

export default function App() {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [unresolved, setUnresolved] = useState<UnresolvedCallSite[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<SimulationResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [evaluationSummary, setEvaluationSummary] = useState<EvaluationSummary | null>(null);
  const [evaluationMarkdown, setEvaluationMarkdown] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'compare' | 'evaluation' | 'pr-comment' | 'runtime' | 'unresolved'>('graph');
  const [loading, setLoading] = useState<boolean>(true);

  // Load initial graph & evaluation data
  const fetchData = async () => {
    try {
      setLoading(true);
      const scanRes = await fetch('/api/scan');
      const scanData = await scanRes.json();
      if (scanData.success) {
        setGraph(scanData.graph);
        setUnresolved(scanData.unresolved || []);
      }

      const evalRes = await fetch('/api/evaluate');
      const evalData = await evalRes.json();
      if (evalData.success) {
        setEvaluationSummary(evalData.summary);
        setEvaluationMarkdown(evalData.markdown);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Run simulation
  const handleRunSimulation = async (scenario: SimulationScenario) => {
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenario)
      });
      const data = await res.json();
      if (data.success) {
        setActiveSimulation(data.result);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  const handleResetSimulation = () => {
    setActiveSimulation(null);
  };

  const handleExportHtml = async () => {
    if (!graph) return;
    try {
      const scenario = activeSimulation?.scenario || {
        id: 'baseline',
        name: 'Normal Operation Baseline',
        targetNodeId: graph.nodes[0]?.id || '',
        action: 'remove_route'
      };

      const res = await fetch('/api/export-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const htmlText = await res.text();
      const blob = new Blob([htmlText], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `graphflow-report-${Date.now()}.html`;
      a.click();
    } catch (err) {
      console.error('Failed to export HTML:', err);
    }
  };

  const selectedNode = graph?.nodes.find((n: GraphNode) => n.id === selectedNodeId) || null;
  const selectedNodeSimResult = selectedNodeId && activeSimulation ? activeSimulation.nodes[selectedNodeId] : undefined;

  if (loading || !graph) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-2xl animate-pulse text-lg">
          GF
        </div>
        <p className="text-sm font-medium">Scanning Full-Stack AST &amp; Building Graph...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
            GF
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-white text-base tracking-tight">GraphFlow</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AST + Runtime Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Full-Stack Blast Radius &amp; Dependency Analyzer</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'graph' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Dependency Graph</span>
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'compare' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare Scenarios</span>
          </button>
          <button
            onClick={() => setActiveTab('evaluation')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'evaluation' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Evaluation Harness</span>
          </button>
          <button
            onClick={() => setActiveTab('pr-comment')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'pr-comment' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>CI / PR Comment</span>
          </button>
          <button
            onClick={() => setActiveTab('runtime')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'runtime' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Runtime Traffic</span>
          </button>
          <button
            onClick={() => setActiveTab('unresolved')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              activeTab === 'unresolved' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Route Matcher</span>
          </button>
        </div>

        {/* Export and Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportHtml}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow"
          >
            <Download className="w-3.5 h-3.5" />
            Export Standalone HTML Report
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Top Summary Metric Banner */}
        <div className="grid grid-cols-5 gap-3 text-xs">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">React Components</div>
              <div className="text-lg font-bold text-white mt-0.5">{graph.summary.totalComponents}</div>
            </div>
            <Layers className="w-5 h-5 text-indigo-400 opacity-80" />
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">API Routes</div>
              <div className="text-lg font-bold text-white mt-0.5">{graph.summary.totalRoutes}</div>
            </div>
            <FileCode className="w-5 h-5 text-cyan-400 opacity-80" />
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">Backend Services</div>
              <div className="text-lg font-bold text-white mt-0.5">{graph.summary.totalServices}</div>
            </div>
            <Activity className="w-5 h-5 text-emerald-400 opacity-80" />
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">Route Match Rate</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{graph.summary.matchRatePercentage}%</div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-80" />
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-[11px]">Current Blast Radius</div>
              <div className="text-lg font-bold mt-0.5 text-rose-400">
                {activeSimulation ? `${activeSimulation.affectedComponentCount} UI Affected` : 'Safe Baseline'}
              </div>
            </div>
            <Zap className="w-5 h-5 text-amber-400 opacity-80" />
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'graph' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Sidebar: Controls & Inspector */}
            <div className="col-span-4 space-y-6">
              {/* Simulation Preset & Custom Controls */}
              <SimulationControls
                graph={graph}
                onRunSimulation={handleRunSimulation}
                onReset={handleResetSimulation}
              />

              {/* Selected Node Details Drawer */}
              {selectedNode && (
                <NodeInspectorModal
                  node={selectedNode}
                  simulationResult={selectedNodeSimResult}
                  onClose={() => setSelectedNodeId(null)}
                  onSimulateNode={(nodeId) => {
                    handleRunSimulation({
                      id: `node_sim_${Date.now()}`,
                      name: `Simulation on ${selectedNode.name}`,
                      targetNodeId: nodeId,
                      action: selectedNode.type === 'route' ? 'remove_route' : selectedNode.type === 'service-function' ? 'service_fail' : 'db_fail'
                    });
                  }}
                />
              )}
            </div>

            {/* Right Main Column: Canvas & Blast Radius Summary */}
            <div className="col-span-8 space-y-4">
              {activeSimulation && (
                <div className="p-4 bg-slate-900/90 border border-amber-500/30 rounded-xl flex items-center justify-between shadow-xl">
                  <div>
                    <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      Active Simulation Running
                    </div>
                    <div className="font-bold text-white text-sm mt-0.5">
                      {activeSimulation.scenario.name}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 font-bold">
                      {activeSimulation.statusCounts.Failed} Failed
                    </span>
                    <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-bold">
                      {activeSimulation.statusCounts.Degraded} Degraded
                    </span>
                    <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                      {activeSimulation.affectedComponentCount} Components Impacted
                    </span>
                  </div>
                </div>
              )}

              <GraphCanvas
                graph={graph}
                simulation={activeSimulation}
                selectedNodeId={selectedNodeId}
                onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
              />
            </div>
          </div>
        )}

        {activeTab === 'compare' && (
          <ScenarioComparisonModal graph={graph} />
        )}

        {activeTab === 'evaluation' && (
          <EvaluationDashboard
            summary={evaluationSummary}
            markdown={evaluationMarkdown}
            onRefresh={fetchData}
          />
        )}

        {activeTab === 'pr-comment' && (
          <PrCommentSimulator simulation={activeSimulation} />
        )}

        {activeTab === 'runtime' && (
          <RuntimeTraceView graph={graph} />
        )}

        {activeTab === 'unresolved' && (
          <UnresolvedSitesModal
            unresolved={unresolved}
            matchRatePercentage={graph.summary.matchRatePercentage}
          />
        )}
      </main>
    </div>
  );
}
