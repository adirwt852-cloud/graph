import React, { useState, useRef, useMemo } from 'react';
import { DependencyGraph, GraphEdge, GraphNode, NodeStatus, SimulationResult } from '../../packages/graph-builder/src/types';
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Cpu, Database, Globe, Layers } from 'lucide-react';

interface Props {
  graph: DependencyGraph;
  simulation: SimulationResult | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export const GraphCanvas: React.FC<Props> = ({ graph, simulation, selectedNodeId, onSelectNode }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [filterType, setFilterType] = useState<string>('all');
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Group nodes by architectural layer
  const layout = useMemo(() => {
    const layerOrder: Record<string, { title: string; x: number }> = {
      'component': { title: 'React Components', x: 130 },
      'route': { title: 'Express API Routes', x: 440 },
      'service-function': { title: 'Backend Services', x: 750 },
      'db-access-point': { title: 'Database Access', x: 1060 },
    };

    const typeGroups: Record<string, GraphNode[]> = {
      'component': [],
      'route': [],
      'service-function': [],
      'db-access-point': []
    };

    graph.nodes.forEach(n => {
      if (typeGroups[n.type]) {
        typeGroups[n.type].push(n);
      }
    });

    const positions: Record<string, { x: number; y: number }> = {};
    const totalHeight = 580;

    Object.keys(typeGroups).forEach(type => {
      const list = typeGroups[type];
      const spacing = totalHeight / (list.length + 1);
      list.forEach((node, idx) => {
        positions[node.id] = {
          x: layerOrder[type]?.x || 300,
          y: (idx + 1) * spacing + 40
        };
      });
    });

    return { layerOrder, positions };
  }, [graph]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as any)?.id === 'svg-bg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const getNodeStatus = (nodeId: string): NodeStatus => {
    if (!simulation || !simulation.nodes[nodeId]) return 'Safe';
    return simulation.nodes[nodeId].status;
  };

  const getNodeColor = (status: NodeStatus) => {
    switch (status) {
      case 'Failed':
        return { bg: '#ef4444', border: '#b91c1c', text: '#fee2e2', glow: 'rgba(239, 68, 68, 0.4)' };
      case 'Degraded':
        return { bg: '#f59e0b', border: '#b45309', text: '#fef3c7', glow: 'rgba(245, 158, 11, 0.4)' };
      case 'Affected':
        return { bg: '#f97316', border: '#c2410c', text: '#ffedd5', glow: 'rgba(249, 115, 22, 0.4)' };
      case 'Safe':
      default:
        return { bg: '#10b981', border: '#047857', text: '#d1fae5', glow: 'rgba(16, 185, 129, 0.2)' };
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'component':
        return <Layers className="w-3.5 h-3.5 inline mr-1 text-indigo-300" />;
      case 'route':
        return <Globe className="w-3.5 h-3.5 inline mr-1 text-cyan-300" />;
      case 'service-function':
        return <Cpu className="w-3.5 h-3.5 inline mr-1 text-emerald-300" />;
      case 'db-access-point':
        return <Database className="w-3.5 h-3.5 inline mr-1 text-amber-300" />;
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-[640px] bg-slate-950 border border-slate-800 rounded-xl overflow-hidden select-none flex flex-col">
      {/* Top Floating Overlay Control Bar */}
      <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-lg shadow-xl pointer-events-auto">
          <button
            onClick={() => setZoom(z => Math.min(z + 0.15, 2.2))}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z - 0.15, 0.5))}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition text-xs flex items-center gap-1 font-medium"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1"></div>

          {/* Filter selector */}
          <div className="flex items-center space-x-1 text-xs">
            {['all', 'component', 'route', 'service-function', 'db-access-point'].map((ft) => (
              <button
                key={ft}
                onClick={() => setFilterType(ft)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  filterType === ft ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ft === 'all' ? 'All Layers' : ft.replace('-function', '').replace('-point', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-lg shadow-xl text-xs pointer-events-auto">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300 text-[11px]">Safe</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-300 text-[11px]">Degraded (Try/Catch)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-slate-300 text-[11px]">Failed / Broken</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-slate-400"></span>
            <span className="text-slate-400 text-[11px]">Unconfirmed</span>
          </div>
        </div>
      </div>

      {/* Main SVG Interactive Graph */}
      <svg
        ref={svgRef}
        id="svg-bg"
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" opacity="0.6" />
          </pattern>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
          </marker>
          <marker id="arrowhead-failed" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-pattern)" id="svg-bg" />

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Layer Boundary Background Columns */}
          {Object.entries(layout.layerOrder).map(([key, val]) => (
            <g key={key} opacity={filterType === 'all' || filterType === key ? 1 : 0.2}>
              <rect
                x={val.x - 110}
                y={20}
                width={220}
                height={600}
                rx={12}
                fill="#0f172a"
                fillOpacity="0.4"
                stroke="#1e293b"
                strokeDasharray="4 4"
              />
              <text
                x={val.x}
                y={50}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="12"
                fontWeight="700"
                letterSpacing="0.05em"
                className="uppercase"
              >
                {val.title}
              </text>
            </g>
          ))}

          {/* Edges */}
          {graph.edges.map((edge) => {
            const srcPos = layout.positions[edge.source];
            const tgtPos = layout.positions[edge.target];
            if (!srcPos || !tgtPos) return null;

            const srcStatus = getNodeStatus(edge.source);
            const tgtStatus = getNodeStatus(edge.target);
            const isFailing = tgtStatus === 'Failed' || tgtStatus === 'Degraded';
            const isSelected = selectedNodeId === edge.source || selectedNodeId === edge.target;
            const isUnconfirmed = edge.runtimeStatus === 'unconfirmed';

            const strokeColor = isFailing ? '#ef4444' : isSelected ? '#818cf8' : isUnconfirmed ? '#64748b' : '#38bdf8';
            const strokeWidth = isSelected ? 2.8 : isFailing ? 2.2 : 1.4;

            // Bezier curve between layers
            const midX = (srcPos.x + tgtPos.x) / 2;
            const pathD = `M ${srcPos.x + 80} ${srcPos.y} C ${midX} ${srcPos.y}, ${midX} ${tgtPos.y}, ${tgtPos.x - 80} ${tgtPos.y}`;

            return (
              <g key={edge.id} className="transition-all duration-200">
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={isUnconfirmed ? '5 4' : 'none'}
                  opacity={isSelected ? 1 : isFailing ? 0.9 : 0.45}
                  markerEnd={isFailing ? 'url(#arrowhead-failed)' : 'url(#arrowhead)'}
                />
                {edge.isTryCatchGuarded && (
                  <circle
                    cx={midX}
                    cy={(srcPos.y + tgtPos.y) / 2}
                    r={5}
                    fill="#f59e0b"
                    stroke="#1e293b"
                    strokeWidth="1.5"
                  >
                    <title>Guarded by try/catch</title>
                  </circle>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((node) => {
            const pos = layout.positions[node.id];
            if (!pos) return null;

            const isFiltered = filterType !== 'all' && filterType !== node.type;
            const isSelected = selectedNodeId === node.id;
            const status = getNodeStatus(node.id);
            const colors = getNodeColor(status);

            const isFailing = status === 'Failed';
            const isDegraded = status === 'Degraded';

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                opacity={isFiltered ? 0.2 : 1}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.id);
                }}
              >
                {/* Highlight Glow Effect on Failure or Selection */}
                {(isFailing || isDegraded || isSelected) && (
                  <rect
                    x={-90}
                    y={-28}
                    width={180}
                    height={56}
                    rx={10}
                    fill="none"
                    stroke={isSelected ? '#6366f1' : colors.bg}
                    strokeWidth={isSelected ? 4 : 2}
                    opacity="0.6"
                    className={isFailing ? 'animate-pulse' : ''}
                  />
                )}

                {/* Node Pill Card */}
                <rect
                  x={-85}
                  y={-24}
                  width={170}
                  height={48}
                  rx={8}
                  fill="#0f172a"
                  stroke={isSelected ? '#818cf8' : colors.border}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="transition-all duration-150 group-hover:fill-slate-800"
                />

                {/* Status Indicator Pip */}
                <circle cx={-70} cy={0} r={5} fill={colors.bg} />

                {/* Node Title */}
                <text
                  x={-58}
                  y={-3}
                  fill="#f8fafc"
                  fontSize="11"
                  fontWeight="600"
                  className="truncate"
                >
                  {node.name.length > 17 ? node.name.slice(0, 16) + '…' : node.name}
                </text>

                {/* Node Subtitle / Type */}
                <text
                  x={-58}
                  y={13}
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {node.type.replace('-function', '').replace('-point', '')}
                </text>

                {/* Try/Catch Resilience Tag */}
                {node.hasTryCatch && (
                  <g transform="translate(62, -14)">
                    <rect x={-8} y={-4} width={24} height={14} rx={3} fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" strokeWidth="0.8" />
                    <text x={4} y={6} textAnchor="middle" fill="#fef3c7" fontSize="8" fontWeight="bold">TRY</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
