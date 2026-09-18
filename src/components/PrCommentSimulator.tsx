import React, { useState } from 'react';
import { DependencyGraph, SimulationResult } from '../../packages/graph-builder/src/types';
import { PrCommentFormatter } from '../../packages/reporter/src/prCommentFormatter';
import { MessageSquare, Copy, Check, ShieldCheck, Filter, BellOff, Bell } from 'lucide-react';

interface Props {
  simulation: SimulationResult | null;
}

export const PrCommentSimulator: React.FC<Props> = ({ simulation }) => {
  const [confidenceThreshold, setConfidenceThreshold] = useState<'high' | 'medium' | 'low'>('medium');
  const [copied, setCopied] = useState(false);

  if (!simulation) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        Run a simulation to preview GitHub PR Comment output.
      </div>
    );
  }

  const commentMarkdown = PrCommentFormatter.formatPrComment(simulation, {
    confidenceThreshold,
    reportArtifactUrl: 'https://github.com/org/repo/actions/runs/84920'
  });

  const handleCopy = () => {
    if (commentMarkdown) {
      navigator.clipboard.writeText(commentMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSuppressed = !commentMarkdown;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-base font-bold text-white">GitHub Action PR Comment Simulator</h2>
            <p className="text-xs text-slate-400">Previews the automated PR comment posted to GitHub with built-in noise control.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Confidence threshold filter */}
          <div className="flex items-center space-x-1.5 text-xs bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Confidence Threshold:</span>
            <select
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white"
            >
              <option value="high">High Only</option>
              <option value="medium">Medium &amp; High</option>
              <option value="low">All (Low, Med, High)</option>
            </select>
          </div>

          {commentMarkdown && (
            <button
              onClick={handleCopy}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
          )}
        </div>
      </div>

      {/* Noise Control Banner */}
      {isSuppressed ? (
        <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl flex items-center space-x-3 text-xs text-emerald-200">
          <BellOff className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold">Zero Noise Suppression Active: </span>
            No broken or affected components detected at `{confidenceThreshold}` confidence threshold. PR comment is intentionally suppressed to prevent developer alert fatigue.
          </div>
        </div>
      ) : (
        <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-center space-x-3 text-xs text-indigo-200">
          <Bell className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <span className="font-bold">Active PR Comment: </span>
            Detected {simulation.affectedComponentCount} affected components. Formatted markdown output below will be posted as an automated GitHub PR review comment.
          </div>
        </div>
      )}

      {/* Markdown Preview Box */}
      {commentMarkdown && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Generated Markdown Comment</div>
          <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-[400px] leading-relaxed whitespace-pre-wrap">
            {commentMarkdown}
          </pre>
        </div>
      )}
    </div>
  );
};
