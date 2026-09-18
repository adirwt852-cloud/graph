import React from 'react';
import { UnresolvedCallSite } from '../../packages/graph-builder/src/types';
import { AlertTriangle, CheckCircle, FileCode, Search } from 'lucide-react';

interface Props {
  unresolved: UnresolvedCallSite[];
  matchRatePercentage: number;
}

export const UnresolvedSitesModal: React.FC<Props> = ({ unresolved, matchRatePercentage }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-bold text-white">Route Matcher &amp; Unresolved Call Sites Audit</h2>
            <p className="text-xs text-slate-400">
              Complete visibility into AST call sites resolved vs unresolved against Express backend routes.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
            {matchRatePercentage}% Resolved Match Rate
          </span>
        </div>
      </div>

      {unresolved.length === 0 ? (
        <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
          <div className="text-sm font-bold text-white">100% Full-Stack Call Site Resolution</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All template strings, shared API client wrapper methods, and fetch call expressions in `/fixtures/standard` were successfully mapped to backend route handlers with high confidence.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Unresolved Call Sites ({unresolved.length})
          </div>
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Component</th>
                  <th className="p-3">Expression</th>
                  <th className="p-3">File &amp; Line</th>
                  <th className="p-3">Reason / Suggestion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                {unresolved.map((u, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-semibold text-white">{u.callerComponent}</td>
                    <td className="p-3 font-mono text-indigo-300">{u.expression}</td>
                    <td className="p-3 font-mono text-slate-400">{u.file}:{u.line}</td>
                    <td className="p-3 text-amber-400">{u.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
