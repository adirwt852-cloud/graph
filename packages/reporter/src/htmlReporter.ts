import * as fs from 'fs';
import * as path from 'path';
import { DependencyGraph, SimulationResult } from '../../graph-builder/src/types';

export class HtmlReporter {
  public static generateHtmlReport(
    graph: DependencyGraph,
    simulationResult: SimulationResult,
    comparisonResult?: any
  ): string {
    const graphDataJson = JSON.stringify(graph);
    const simResultJson = JSON.stringify(simulationResult);
    const comparisonJson = JSON.stringify(comparisonResult || null);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GraphFlow - Blast Radius Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    code, pre { font-family: 'JetBrains Mono', monospace; }
    .node-safe { fill: #10b981; stroke: #047857; }
    .node-degraded { fill: #f59e0b; stroke: #b45309; }
    .node-affected { fill: #ef4444; stroke: #b91c1c; }
    .node-failed { fill: #dc2626; stroke: #991b1b; }
    .node-unconfirmed { stroke-dasharray: 4 2; }
    .edge-line { stroke: #cbd5e1; stroke-width: 1.5; }
    .edge-highlight { stroke: #ef4444; stroke-width: 2.5; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col">
  <!-- Header -->
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
    <div class="flex items-center space-x-3">
      <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">GF</div>
      <div>
        <h1 class="font-bold text-lg text-white">GraphFlow Blast Radius Report</h1>
        <p class="text-xs text-slate-400">Simulation: <span class="text-indigo-400 font-medium" id="scenario-title">${simulationResult.scenario.name}</span></p>
      </div>
    </div>
    <div class="flex items-center space-x-4">
      <div class="flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
        <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span> <span>Safe (${simulationResult.statusCounts.Safe})</span>
        <span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 ml-2"></span> <span>Degraded (${simulationResult.statusCounts.Degraded})</span>
        <span class="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 ml-2"></span> <span>Failed/Affected (${simulationResult.statusCounts.Failed + simulationResult.statusCounts.Affected})</span>
      </div>
      <button onclick="window.print()" class="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md font-medium transition">Export / Print</button>
    </div>
  </header>

  <!-- Main Container -->
  <main class="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
    <!-- Graph Canvas Viewport -->
    <div class="col-span-8 bg-slate-950 relative overflow-hidden flex flex-col border-r border-slate-800">
      <!-- Toolbar -->
      <div class="absolute top-4 left-4 z-10 flex space-x-2 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-lg text-xs shadow-xl">
        <button id="btn-zoom-in" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold">+</button>
        <button id="btn-zoom-out" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold">-</button>
        <button id="btn-reset" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">Reset View</button>
        <div class="h-4 w-px bg-slate-700 my-auto"></div>
        <span class="text-slate-400 my-auto px-1">Tip: Click any node to inspect file & line blame</span>
      </div>

      <div class="w-full flex-1 flex items-center justify-center p-4">
        <svg id="graph-svg" class="w-full h-[650px] cursor-grab active:cursor-grabbing"></svg>
      </div>
    </div>

    <!-- Inspector & Details Sidebar -->
    <div class="col-span-4 bg-slate-900/95 overflow-y-auto p-6 flex flex-col space-y-6">
      <!-- Summary Card -->
      <div class="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Simulation Summary</h2>
        <div class="grid grid-cols-3 gap-3 mt-3 text-center">
          <div class="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
            <div class="text-2xl font-bold text-rose-400">${simulationResult.affectedComponentCount}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Affected UI</div>
          </div>
          <div class="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
            <div class="text-2xl font-bold text-amber-400">${simulationResult.statusCounts.Degraded}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Degraded</div>
          </div>
          <div class="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
            <div class="text-2xl font-bold text-indigo-400">${simulationResult.maxPropagationDepth}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Max Depth</div>
          </div>
        </div>
      </div>

      <!-- Selected Node Inspection -->
      <div id="node-inspector" class="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 flex flex-col space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <span id="insp-type-badge" class="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Node</span>
            <h3 id="insp-name" class="font-bold text-base text-white mt-1">Select a Node</h3>
          </div>
          <span id="insp-status-badge" class="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-700 text-slate-300">Safe</span>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Root Cause / Reason</h4>
          <p id="insp-reason" class="text-xs text-slate-300 mt-1.5 leading-relaxed bg-slate-900/80 p-3 rounded-lg border border-slate-800">
            Click on any node in the interactive graph to view its blast radius impact, try/catch error handling status, and call chain.
          </p>
        </div>

        <!-- Field Blame if present -->
        <div id="insp-field-blame" class="hidden bg-rose-950/40 border border-rose-800/50 p-3 rounded-lg">
          <div class="text-xs font-semibold text-rose-300">⚡ Field-Level Blame</div>
          <div id="insp-field-text" class="text-xs text-rose-200/90 mt-1 font-mono"></div>
        </div>

        <!-- Propagation Chain -->
        <div>
          <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Propagation Chain</h4>
          <div id="insp-chain" class="text-xs text-slate-400 mt-1.5 space-y-1 font-mono">
            <span class="text-slate-500">None</span>
          </div>
        </div>

        <!-- File & Line Link -->
        <div class="pt-2 border-t border-slate-700/50 text-xs text-slate-400 flex justify-between items-center">
          <span>Source location:</span>
          <span id="insp-file" class="font-mono text-indigo-300 text-[11px] truncate max-w-[200px]">N/A</span>
        </div>
      </div>

      <!-- Affected Nodes Quick List -->
      <div class="space-y-2">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">Impacted Components & Routes</h3>
        <div id="impacted-list" class="space-y-1.5">
          <!-- Populated by JS -->
        </div>
      </div>
    </div>
  </main>

  <script>
    const graphData = ${graphDataJson};
    const simResult = ${simResultJson};

    // Simple Force & SVG Layout Renderer
    const svg = document.getElementById('graph-svg');
    const nodes = graphData.nodes;
    const edges = graphData.edges;

    // Coordinate calculation per layer
    const layerX = {
      'component': 120,
      'route': 340,
      'service-function': 580,
      'db-access-point': 820
    };

    const typeGroups = { 'component': [], 'route': [], 'service-function': [], 'db-access-point': [] };
    nodes.forEach(n => {
      if (typeGroups[n.type]) typeGroups[n.type].push(n);
    });

    const positions = {};
    Object.keys(typeGroups).forEach(type => {
      const list = typeGroups[type];
      const stepY = 560 / (list.length + 1);
      list.forEach((n, idx) => {
        positions[n.id] = {
          x: layerX[type] || 400,
          y: (idx + 1) * stepY + 40
        };
      });
    });

    // Render Edges
    let edgesSvg = '';
    edges.forEach(e => {
      const src = positions[e.source];
      const tgt = positions[e.target];
      if (src && tgt) {
        const tgtStatus = simResult.nodes[e.target]?.status;
        const isImpacted = tgtStatus && tgtStatus !== 'Safe';
        const color = isImpacted ? '#ef4444' : (e.runtimeStatus === 'unconfirmed' ? '#64748b' : '#38bdf8');
        const dash = e.runtimeStatus === 'unconfirmed' ? 'stroke-dasharray="4 4"' : '';
        edgesSvg += \`<path d="M \${src.x} \${src.y} C \${(src.x+tgt.x)/2} \${src.y}, \${(src.x+tgt.x)/2} \${tgt.y}, \${tgt.x} \${tgt.y}" fill="none" stroke="\${color}" stroke-width="\${isImpacted ? '2.5' : '1.5'}" opacity="\${isImpacted ? '0.9' : '0.4'}" \${dash} />\`;
      }
    });

    // Render Nodes
    let nodesSvg = '';
    nodes.forEach(n => {
      const pos = positions[n.id] || { x: 400, y: 300 };
      const nodeSim = simResult.nodes[n.id] || { status: 'Safe' };
      const status = nodeSim.status;

      let color = '#10b981'; // Safe
      let stroke = '#059669';
      if (status === 'Degraded') { color = '#f59e0b'; stroke = '#d97706'; }
      else if (status === 'Affected') { color = '#f97316'; stroke = '#ea580c'; }
      else if (status === 'Failed') { color = '#ef4444'; stroke = '#dc2626'; }

      nodesSvg += \`
        <g class="cursor-pointer group" onclick="selectNode('\${n.id}')">
          <circle cx="\${pos.x}" cy="\${pos.y}" r="18" fill="\${color}" stroke="\${stroke}" stroke-width="2.5" class="transition group-hover:scale-125" />
          <text x="\${pos.x}" y="\${pos.y - 24}" text-anchor="middle" fill="#f8fafc" font-size="11" font-weight="600">\${n.name}</text>
          <text x="\${pos.x}" y="\${pos.y + 32}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="monospace">\${n.type}</text>
        </g>
      \`;
    });

    svg.innerHTML = \`<g id="viewport">\${edgesSvg}\${nodesSvg}</g>\`;

    // Populate Affected List
    const impactedList = document.getElementById('impacted-list');
    Object.values(simResult.nodes).forEach(res => {
      if (res.status !== 'Safe') {
        const div = document.createElement('div');
        div.className = 'p-2 bg-slate-950/70 border border-slate-800 rounded-md cursor-pointer hover:border-slate-700 transition flex items-center justify-between text-xs';
        div.onclick = () => selectNode(res.nodeId);
        
        let badgeColor = 'bg-emerald-500/20 text-emerald-300';
        if (res.status === 'Degraded') badgeColor = 'bg-amber-500/20 text-amber-300';
        else if (res.status === 'Failed') badgeColor = 'bg-rose-500/20 text-rose-300';
        else if (res.status === 'Affected') badgeColor = 'bg-orange-500/20 text-orange-300';

        div.innerHTML = \`
          <span class="font-medium text-slate-200">\${res.node.name}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] \${badgeColor}">\${res.status}</span>
        \`;
        impactedList.appendChild(div);
      }
    });

    window.selectNode = function(id) {
      const node = nodes.find(n => n.id === id);
      const res = simResult.nodes[id];
      if (!node || !res) return;

      document.getElementById('insp-name').textContent = node.name;
      document.getElementById('insp-type-badge').textContent = node.type;
      document.getElementById('insp-status-badge').textContent = res.status;
      
      const badge = document.getElementById('insp-status-badge');
      badge.className = 'px-2.5 py-1 text-xs font-semibold rounded-full ' + 
        (res.status === 'Safe' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
         res.status === 'Degraded' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
         'bg-rose-500/20 text-rose-300 border border-rose-500/40');

      document.getElementById('insp-reason').textContent = res.reason;
      document.getElementById('insp-file').textContent = node.file ? (node.file.split('/').slice(-2).join('/') + ':' + node.line) : 'N/A';

      // Chain
      const chainEl = document.getElementById('insp-chain');
      if (res.propagationPath && res.propagationPath.length > 0) {
        chainEl.innerHTML = res.propagationPath.map(nodeId => {
          const n = nodes.find(x => x.id === nodeId);
          return \`<div class="bg-slate-950 p-1 px-2 rounded border border-slate-800 text-indigo-300 text-[11px]">\${n ? n.name : nodeId}</div>\`;
        }).join('<div class="text-slate-600 text-center py-0.5">↓ propagates to</div>');
      } else {
        chainEl.innerHTML = '<span class="text-slate-500">Directly affected or root cause</span>';
      }

      // Field blame
      const fieldEl = document.getElementById('insp-field-blame');
      if (res.fieldBlame) {
        fieldEl.classList.remove('hidden');
        document.getElementById('insp-field-text').textContent = res.fieldBlame.explanation;
      } else {
        fieldEl.classList.add('hidden');
      }
    };
  </script>
</body>
</html>`;
  }

  public static saveHtmlReport(
    filePath: string,
    graph: DependencyGraph,
    simulationResult: SimulationResult,
    comparisonResult?: any
  ): string {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const html = this.generateHtmlReport(graph, simulationResult, comparisonResult);
    fs.writeFileSync(filePath, html, 'utf-8');
    return filePath;
  }
}
