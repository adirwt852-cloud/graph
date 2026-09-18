import React, { useState } from 'react';
import { DependencyGraph, SimulationResult } from '../../packages/graph-builder/src/types';
import { WhatIfSimulator } from '../../packages/simulator/src/simulator';
import { GitCompare, ArrowRight, ShieldCheck, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  graph: DependencyGraph;
}

export const ScenarioComparisonModal: React.FC<Props> = ({ graph }) => {
  const simulator = new WhatIfSimulator();

  const [targetA, setTargetA] = useState<string>('route:GET:/api/users/:id');
  const [actionA, setActionA] = useState<any>('remove_route');

  const [targetB, setTargetB] = useState<string>('db:db.orders.findOne');
  const [actionB, setActionB] = useState<any>('db_fail');

  const resultA = simulator.runSimulation(graph, {
    id: 'sim_A',
    name: `Scenario A (${actionA} on ${targetA})`,
    targetNodeId: targetA,
    action: actionA
  });

  const resultB = simulator.runSimulation(graph, {
    id: 'sim_B',
    name: `Scenario B (${actionB} on ${targetB})`,
    targetNodeId: targetB,
    action: actionB
  });

  const comparison = simulator.compareScenarios(resultA, resultB);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 text-slate-200">
      <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
        <GitCompare className="w-5 h-5 text-indigo-400" />
        <div>
          <h2 className="text-base font-bold text-white">Side-by-Side Scenario Blast Radius Comparison</h2>
          <p className="text-xs text-slate-400">Compare failure propagation paths and UI degradation across two distinct outage types.</p>
        </div>
      </div>

      {/* Scenario Selectors */}
      <div className="grid grid-cols-2 gap-4">
        {/* Scenario A */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-cyan-600/30 text-cyan-300 border border-cyan-500/30">
              Scenario A
            </span>
            <span className="text-xs text-rose-400 font-semibold">{resultA.affectedComponentCount} UI Affected</span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Target Node:</label>
              <select
                value={targetA}
                onChange={(e) => setTargetA(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
              >
                {graph.nodes.map(n => (
                  <option key={n.id} value={n.id}>[{n.type}] {n.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Action:</label>
              <select
                value={actionA}
                onChange={(e) => setActionA(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
              >
                <option value="remove_route">Remove Route</option>
                <option value="service_fail">Service Outage</option>
                <option value="db_fail">DB Outage</option>
                <option value="latency_increase">Latency Increase</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scenario B */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-purple-600/30 text-purple-300 border border-purple-500/30">
              Scenario B
            </span>
            <span className="text-xs text-rose-400 font-semibold">{resultB.affectedComponentCount} UI Affected</span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Target Node:</label>
              <select
                value={targetB}
                onChange={(e) => setTargetB(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
              >
                {graph.nodes.map(n => (
                  <option key={n.id} value={n.id}>[{n.type}] {n.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Action:</label>
              <select
                value={actionB}
                onChange={(e) => setActionB(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
              >
                <option value="remove_route">Remove Route</option>
                <option value="service_fail">Service Outage</option>
                <option value="db_fail">DB Outage</option>
                <option value="latency_increase">Latency Increase</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Difference Highlights */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Affected Components Diff</div>
          <div className="text-lg font-bold text-indigo-400 mt-1">
            {comparison.diffSummary.affectedComponentsDiff > 0 ? `+${comparison.diffSummary.affectedComponentsDiff}` : comparison.diffSummary.affectedComponentsDiff}
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Failed Nodes Diff</div>
          <div className="text-lg font-bold text-rose-400 mt-1">
            {comparison.diffSummary.failedNodesDiff > 0 ? `+${comparison.diffSummary.failedNodesDiff}` : comparison.diffSummary.failedNodesDiff}
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Degraded Nodes Diff</div>
          <div className="text-lg font-bold text-amber-400 mt-1">
            {comparison.diffSummary.degradedNodesDiff > 0 ? `+${comparison.diffSummary.degradedNodesDiff}` : comparison.diffSummary.degradedNodesDiff}
          </div>
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="text-xs text-slate-400">Propagation Depth Diff</div>
          <div className="text-lg font-bold text-cyan-400 mt-1">
            {comparison.diffSummary.propagationDepthDiff > 0 ? `+${comparison.diffSummary.propagationDepthDiff}` : comparison.diffSummary.propagationDepthDiff}
          </div>
        </div>
      </div>

      {/* Diff Table */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Node-by-Node Impact Matrix ({comparison.nodeDiffTable.length} Impacted Nodes)
        </h3>
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-2.5">Node</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Scenario A Status</th>
                <th className="p-2.5">Scenario B Status</th>
                <th className="p-2.5">Comparative Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {comparison.nodeDiffTable.map((row) => (
                <tr key={row.nodeId} className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-medium text-white">{row.name}</td>
                  <td className="p-2.5 text-slate-400 font-mono text-[11px]">{row.type}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      row.statusA === 'Failed' ? 'bg-rose-500/20 text-rose-300' :
                      row.statusA === 'Degraded' ? 'bg-amber-500/20 text-amber-300' :
                      row.statusA === 'Affected' ? 'bg-orange-500/20 text-orange-300' :
                      'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {row.statusA}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      row.statusB === 'Failed' ? 'bg-rose-500/20 text-rose-300' :
                      row.statusB === 'Degraded' ? 'bg-amber-500/20 text-amber-300' :
                      row.statusB === 'Affected' ? 'bg-orange-500/20 text-orange-300' :
                      'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {row.statusB}
                    </span>
                  </td>
                  <td className="p-2.5 text-[11px] text-slate-300">
                    {row.statusA === row.statusB ? (
                      <span className="text-slate-500">Identical impact</span>
                    ) : (
                      <span className="text-indigo-300 font-medium">{row.statusA} ➔ {row.statusB}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
