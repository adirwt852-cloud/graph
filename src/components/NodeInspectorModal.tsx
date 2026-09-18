import React from 'react';
import { GraphNode, SimulationNodeResult } from '../../packages/graph-builder/src/types';
import { X, FileCode, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight, Zap, ExternalLink, Activity } from 'lucide-react';

interface Props {
  node: GraphNode;
  simulationResult: SimulationNodeResult | undefined;
  onClose: () => void;
  onSimulateNode: (nodeId: string) => void;
}

export const NodeInspectorModal: React.FC<Props> = ({ node, simulationResult, onClose, onSimulateNode }) => {
  const status = simulationResult?.status || 'Safe';

  const getStatusBadge = () => {
    switch (status) {
      case 'Failed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> Failed</span>;
      case 'Degraded':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Degraded (Resilient)</span>;
      case 'Affected':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/40 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Affected</span>;
      case 'Safe':
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Safe</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4 text-slate-200">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
              {node.type}
            </span>
            {node.httpMethod && (
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-cyan-600/30 text-cyan-300 border border-cyan-500/30">
                {node.httpMethod}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white mt-1.5">{node.name}</h2>
          <div className="flex items-center text-xs text-slate-400 mt-0.5 gap-1.5 font-mono">
            <FileCode className="w-3.5 h-3.5 text-slate-500" />
            <span className="truncate max-w-sm">{node.file}:{node.line}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Root Cause / Blast Radius Reason */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          Status Analysis &amp; Explanation
        </h3>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs leading-relaxed">
          {simulationResult?.reason || 'Node is operating normally with no upstream failures or schema changes detected.'}
        </div>
      </div>

      {/* Field Level Blame */}
      {simulationResult?.fieldBlame && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-800/50 rounded-lg space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
            <Zap className="w-3.5 h-3.5" />
            Field-Level Blame Detected: `{simulationResult.fieldBlame.field}`
          </div>
          <p className="text-xs text-rose-200 font-mono">{simulationResult.fieldBlame.explanation}</p>
          <div className="text-[11px] text-rose-400">Confidence: <b>{simulationResult.fieldBlame.confidence.toUpperCase()}</b></div>
        </div>
      )}

      {/* Propagation Path Chain */}
      {simulationResult?.propagationPath && simulationResult.propagationPath.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Propagation Path Chain ({simulationResult.propagationPath.length} hops)
          </h3>
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1 font-mono text-xs">
            {simulationResult.propagationPath.map((hop, idx) => (
              <div key={hop} className="flex items-center space-x-2">
                <span className="text-slate-500 text-[10px] w-4">{idx + 1}.</span>
                <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-indigo-300 text-[11px]">
                  {hop}
                </span>
                {idx < simulationResult.propagationPath.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Snippet */}
      {node.codeSnippet && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Source Code Preview</h3>
          <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
            {node.codeSnippet}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex items-center justify-between border-t border-slate-800 text-xs">
        <button
          onClick={() => onSimulateNode(node.id)}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition shadow flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          Simulate Outage on This Node
        </button>

        <span className="text-slate-500 font-mono text-[11px]">
          ID: {node.id}
        </span>
      </div>
    </div>
  );
};
