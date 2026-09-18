import React, { useState } from 'react';
import { DependencyGraph, SimulationScenario } from '../../packages/graph-builder/src/types';
import { Zap, Play, RotateCcw, Sliders, Shield, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  graph: DependencyGraph;
  onRunSimulation: (scenario: SimulationScenario) => void;
  onReset: () => void;
}

const PRESET_SCENARIOS: SimulationScenario[] = [
  {
    id: 'preset-1',
    name: '1. Remove Route: GET /api/users/:id',
    targetNodeId: 'route:GET:/api/users/:id',
    action: 'remove_route',
    description: 'Simulates unmounting the /api/users/:id endpoint. UserProfile gracefully degrades via try/catch.'
  },
  {
    id: 'preset-2',
    name: '2. Service Outage: userService.findUserById',
    targetNodeId: 'service:userService:findUserById',
    action: 'service_fail',
    description: 'Cascades through both /api/users/:id route and order checkout validation in orderService.'
  },
  {
    id: 'preset-3',
    name: '3. DB Outage: db.orders.*',
    targetNodeId: 'db:db.orders.findOne',
    action: 'db_fail',
    description: 'Simulates database outage on orders collection. OrderSummary fails due to unhandled promise rejection.'
  },
  {
    id: 'preset-4',
    name: '4. Field Rename: User.userId ➔ accountIdentifier',
    targetNodeId: 'route:GET:/api/users/:id',
    action: 'field_rename',
    field: 'userId',
    newField: 'accountIdentifier',
    description: 'Performs AST field-level dataflow tracking to find exact JSX destructuring blame in UserProfile.tsx:20.'
  },
  {
    id: 'preset-5',
    name: '5. Latency Spike: db.users.findOne (+2500ms)',
    targetNodeId: 'db:db.users.findOne',
    action: 'latency_increase',
    latencyMs: 2500,
    description: 'Simulates DB query degradation. Direct callers become Degraded without triggering full outage cascade.'
  }
];

export const SimulationControls: React.FC<Props> = ({ graph, onRunSimulation, onReset }) => {
  const [selectedTarget, setSelectedTarget] = useState<string>(graph.nodes[0]?.id || '');
  const [selectedAction, setSelectedAction] = useState<any>('remove_route');
  const [customField, setCustomField] = useState('userId');
  const [customNewField, setCustomNewField] = useState('accountIdentifier');
  const [customLatency, setCustomLatency] = useState(2500);

  const handleCustomRun = () => {
    const targetNode = graph.nodes.find(n => n.id === selectedTarget);
    onRunSimulation({
      id: `custom_${Date.now()}`,
      name: `Custom: ${selectedAction} on ${targetNode?.name || selectedTarget}`,
      targetNodeId: selectedTarget,
      action: selectedAction,
      field: customField,
      newField: customNewField,
      latencyMs: customLatency
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 text-slate-200 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h2 className="font-bold text-white text-base">What-If Blast Radius Simulator</h2>
        </div>
        <button
          onClick={onReset}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Safe Baseline
        </button>
      </div>

      {/* Preset Scenarios */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Preset Verification Scenarios
        </label>
        <div className="grid grid-cols-1 gap-2">
          {PRESET_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => onRunSimulation(scenario)}
              className="text-left p-3 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 transition group flex items-start justify-between"
            >
              <div>
                <div className="font-semibold text-xs text-white group-hover:text-indigo-300 transition">
                  {scenario.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {scenario.description}
                </div>
              </div>
              <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition ml-2 mt-0.5 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Custom Scenario Builder */}
      <div className="pt-3 border-t border-slate-800/80 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          Custom Outage / Change Builder
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Target Node:</label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:border-indigo-500 outline-none"
            >
              {graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.type.replace('-function', '').replace('-point', '')}] {n.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Action Type:</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:border-indigo-500 outline-none"
            >
              <option value="remove_route">Remove Route (404 Outage)</option>
              <option value="service_fail">Service Exception / Failure</option>
              <option value="db_fail">Database Connection Outage</option>
              <option value="field_rename">Field Rename (Schema Drift)</option>
              <option value="latency_increase">Latency Increase (+ms)</option>
            </select>
          </div>
        </div>

        {selectedAction === 'field_rename' && (
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400">Current Field:</label>
              <input
                type="text"
                value={customField}
                onChange={(e) => setCustomField(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                placeholder="e.g. userId"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Renamed To:</label>
              <input
                type="text"
                value={customNewField}
                onChange={(e) => setCustomNewField(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
                placeholder="e.g. accountIdentifier"
              />
            </div>
          </div>
        )}

        {selectedAction === 'latency_increase' && (
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
            <label className="text-[11px] text-slate-400 block mb-1">Added Latency: {customLatency}ms</label>
            <input
              type="range"
              min="500"
              max="10000"
              step="500"
              value={customLatency}
              onChange={(e) => setCustomLatency(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
        )}

        <button
          onClick={handleCustomRun}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Run Custom Blast Radius Simulation
        </button>
      </div>
    </div>
  );
};
