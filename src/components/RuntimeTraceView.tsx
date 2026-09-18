import React from 'react';
import { DependencyGraph, RuntimeTraceEntry } from '../../packages/graph-builder/src/types';
import { Activity, Database, CheckCircle, AlertCircle, ShieldAlert, Cpu, Route } from 'lucide-react';

interface Props {
  graph: DependencyGraph;
}

export const RuntimeTraceView: React.FC<Props> = ({ graph }) => {
  // Sample traces correlated via AsyncLocalStorage
  const sampleTraces: RuntimeTraceEntry[] = [
    {
      traceId: 'trc_101',
      timestamp: '2026-09-18T06:18:22.104Z',
      method: 'GET',
      route: '/api/users/:id',
      path: '/api/users/usr_101',
      statusCode: 200,
      durationMs: 14,
      dbCalls: [
        { callName: 'db.users.findOne', durationMs: 4, meta: { query: { id: 'usr_101' } } }
      ]
    },
    {
      traceId: 'trc_102',
      timestamp: '2026-09-18T06:18:24.312Z',
      method: 'GET',
      route: '/api/users',
      path: '/api/users',
      statusCode: 200,
      durationMs: 22,
      dbCalls: [
        { callName: 'db.users.find', durationMs: 7, meta: { status: 'active' } }
      ]
    },
    {
      traceId: 'trc_103',
      timestamp: '2026-09-18T06:18:27.849Z',
      method: 'POST',
      route: '/api/orders/checkout',
      path: '/api/orders/checkout',
      statusCode: 200,
      durationMs: 48,
      dbCalls: [
        { callName: 'db.users.findOne', durationMs: 6, meta: { id: 'usr_101' } },
        { callName: 'db.orders.insertOne', durationMs: 12, meta: { orderId: 'ord_501' } }
      ]
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-base font-bold text-white">Runtime Traffic Verification Log</h2>
            <p className="text-xs text-slate-400">
              AsyncLocalStorage request context correlator logging HTTP transactions and downstream DB query executions.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
            {graph.summary.confirmedEdges} Confirmed Edges
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {graph.summary.unconfirmedEdges} Unconfirmed Paths
          </span>
        </div>
      </div>

      {/* Traces List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Correlated Request &amp; Database Query Traces
        </h3>

        <div className="space-y-2.5">
          {sampleTraces.map((trace) => (
            <div key={trace.traceId} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    trace.method === 'GET' ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/30' : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {trace.method}
                  </span>
                  <span className="font-mono text-sm font-semibold text-white">{trace.path}</span>
                  <span className="text-slate-500 text-xs">➔ route: {trace.route}</span>
                </div>

                <div className="flex items-center space-x-2 text-xs font-mono">
                  <span className="text-emerald-400 font-bold">{trace.statusCode} OK</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-indigo-300">{trace.durationMs}ms</span>
                </div>
              </div>

              {/* DB Queries in Request Lifecycle */}
              <div className="pl-4 border-l-2 border-slate-800 space-y-1.5 pt-1">
                <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  Database Queries Intercepted ({trace.dbCalls.length}):
                </div>
                {trace.dbCalls.map((db, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800/80 font-mono">
                    <span className="text-amber-300">{db.callName}()</span>
                    <span className="text-slate-400 text-[11px]">{db.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dead / Unconfirmed Code Note */}
      <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
        <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <b>Preservation of Dead / Unexercised Code:</b> Unconfirmed edges (like `GET /api/orders/:id`) are flagged in gray dashed styling rather than purged from the graph. Dead code paths are preserved for auditability and never falsely omitted from blast radius checks.
        </p>
      </div>
    </div>
  );
};
