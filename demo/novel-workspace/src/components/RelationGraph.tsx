/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CodexEntry } from '../types';
import { Compass, Users, Swords, Shield, HeartHandshake, EyeOff, Info } from 'lucide-react';

interface RelationGraphProps {
  codex: CodexEntry[];
  onSelectNode: (id: string) => void;
}

interface Edge {
  source: string;
  target: string;
  label: string;
}

export default function RelationGraph({ codex, onSelectNode }: RelationGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Define hardcoded semantic edges for our default characters, items and locations
  const edges: Edge[] = [
    { source: "char_luchen", target: "char_linsuwei", label: "量子寄宿/指引" },
    { source: "char_luohou", target: "char_luchen", label: "天网缉捕/死敌" },
    { source: "char_luchen", target: "item_chengying", label: "本命御剑" },
    { source: "char_luchen", target: "item_jiuyou", label: "融合宿主" },
    { source: "char_linsuwei", target: "item_jiuyou", label: "魂系核心" },
    { source: "char_luchen", target: "loc_sector13", label: "出身避难" },
    { source: "char_luohou", target: "loc_shangtian", label: "效忠归属" },
    { source: "char_linsuwei", target: "loc_shangtian", label: "反叛逃离" },
  ];

  // Dynamic coordinates solver - layout nodes on a circle or specialized positions
  const width = 640;
  const height = 365;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 135;

  // Let's pre-assign clean coordinates to the default nodes for beautiful static balance,
  // and dynamically place any newly added custom codex nodes in a circular ring.
  const staticCoords: Record<string, { x: number; y: number }> = {
    char_luchen: { x: centerX - 30, y: centerY + 20 },
    char_linsuwei: { x: centerX - 120, y: centerY - 60 },
    char_luohou: { x: centerX + 150, y: centerY + 40 },
    item_chengying: { x: centerX - 50, y: centerY + 130 },
    item_jiuyou: { x: centerX - 160, y: centerY + 55 },
    loc_sector13: { x: centerX + 40, y: centerY - 130 },
    loc_shangtian: { x: centerX + 160, y: centerY - 90 },
  };

  // Build the positions lookup table
  const nodePositions: Record<string, { x: number; y: number }> = {};
  
  codex.forEach((entry, idx) => {
    if (staticCoords[entry.id]) {
      nodePositions[entry.id] = staticCoords[entry.id];
    } else {
      // Calculate circular coordinates for new user-created nodes
      const angle = (idx / Math.max(1, codex.length)) * 2 * Math.PI;
      nodePositions[entry.id] = {
        x: centerX + Math.cos(angle) * (radius + 20),
        y: centerY + Math.sin(angle) * (radius + 20),
      };
    }
  });

  const getNodeIcon = (type: CodexEntry['type']) => {
    switch (type) {
      case 'character': return <Users className="w-4 h-4 text-emerald-700" />;
      case 'item': return <Swords className="w-4 h-4 text-amber-700" />;
      case 'location': return <Compass className="w-4 h-4 text-indigo-700" />;
      case 'faction': return <Shield className="w-4 h-4 text-rose-700" />;
    }
  };

  const handleNodeClick = (id: string) => {
    setSelectedNodeId(selectedNodeId === id ? null : id);
    onSelectNode(id);
  };

  // Filter edges connected to the selected node, if any node is active
  const activeEdges = selectedNodeId
    ? edges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
    : edges;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 h-full flex flex-col relative select-none">
      {/* Legend & Guide bar */}
      <div className="flex justify-between items-center pb-2.5 border-b border-stone-200/60 mb-2">
        <div className="flex items-center gap-1.5 text-stone-700">
          <HeartHandshake className="w-4.5 h-4.5 text-amber-800" />
          <h3 className="font-serif font-bold text-xs">项目设定关联图谱 (Story Codex Graph)</h3>
        </div>
        <div className="flex gap-2 text-[9.5px] font-mono text-stone-500">
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-emerald-300" /> 角色</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-amber-300" /> 道具</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-indigo-300" /> 地点</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="flex-1 bg-white rounded border border-stone-100 shadow-inner overflow-hidden relative">
        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            {/* Arrow Marker */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="16"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#b45309" className="opacity-45" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#b45309" className="opacity-90" />
            </marker>
          </defs>

          {/* Render Connection Lines (Edges) */}
          {edges.map((edge, index) => {
            const start = nodePositions[edge.source];
            const end = nodePositions[edge.target];
            if (!start || !end) return null;

            const isSelectedEdge = selectedNodeId === edge.source || selectedNodeId === edge.target;
            const isFaded = selectedNodeId && !isSelectedEdge;

            // Curved quadratic Bezier coordinate calculation for elegant visual arcs
            const midX = (start.x + end.x) / 2 + (start.y - end.y) * 0.15;
            const midY = (start.y + end.y) / 2 - (start.x - end.x) * 0.15;

            return (
              <g key={index} className="transition-opacity duration-300">
                <path
                  d={`M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`}
                  fill="none"
                  stroke={isSelectedEdge ? "#b45309" : "#e7e5e4"}
                  strokeWidth={isSelectedEdge ? 2 : 1.2}
                  strokeDasharray={isSelectedEdge ? "none" : "3 3"}
                  markerEnd={isSelectedEdge ? "url(#arrow-active)" : "url(#arrow)"}
                  className={`transition-all ${isFaded ? "opacity-15" : "opacity-80"}`}
                />
                
                {/* Text Label on edge */}
                {!isFaded && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-38"
                      y="-7"
                      width="76"
                      height="14"
                      rx="3"
                      fill="#fafaf9"
                      stroke={isSelectedEdge ? "#f59e0b" : "#e7e5e4"}
                      strokeWidth="0.5"
                      className="opacity-95"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-serif text-[9px] fill-stone-500 font-semibold"
                      y="1"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Render Entities (Nodes) */}
          {codex.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const isSelected = selectedNodeId === node.id;
            const isConnected = selectedNodeId && edges.some(e => 
              (e.source === selectedNodeId && e.target === node.id) ||
              (e.target === selectedNodeId && e.source === node.id)
            );
            const isFaded = selectedNodeId && !isSelected && !isConnected;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => handleNodeClick(node.id)}
                className={`cursor-pointer transition-all duration-300 ${isFaded ? "opacity-35 scale-90" : "scale-100"}`}
              >
                {/* Outer pulsing glow ring if selected */}
                {isSelected && (
                  <circle
                    r="23"
                    fill="none"
                    stroke="#b45309"
                    strokeWidth="2"
                    className="animate-ping opacity-25"
                  />
                )}

                {/* Node circle background */}
                <circle
                  r={isSelected ? "17" : "15"}
                  fill={
                    node.type === 'character' ? '#ecfdf5' : 
                    node.type === 'item' ? '#fffbeb' : 
                    node.type === 'location' ? '#f0f9ff' : '#fff1f2'
                  }
                  stroke={isSelected ? "#b45309" : "#d6d3d1"}
                  strokeWidth={isSelected ? "2.5" : "1.5"}
                  className="shadow-sm hover:stroke-stone-500 transition-colors"
                />

                {/* Center Icon */}
                <g transform="translate(-8, -8)">
                  {getNodeIcon(node.type)}
                </g>

                {/* Label Tag (Floating above or below node) */}
                <g transform={`translate(0, ${isSelected ? "27" : "24"})`}>
                  <rect
                    x="-42"
                    y="-7"
                    width="84"
                    height="15"
                    rx="4"
                    fill={isSelected ? "#1c1917" : "#fafaf9"}
                    stroke={isSelected ? "#1c1917" : "#e7e5e4"}
                    strokeWidth="1"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`font-serif text-[10px] font-bold ${isSelected ? "fill-stone-100" : "fill-stone-800"}`}
                    y="1.5"
                  >
                    {node.name}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Tip panel */}
        <div className="absolute bottom-2 left-2 bg-stone-900/85 backdrop-blur-xs p-2 rounded text-[10px] text-stone-200 max-w-[210px] space-y-1 shadow-sm font-sans pointer-events-none">
          <p className="font-serif font-bold text-amber-400 flex items-center gap-1">
            <Info className="w-3 h-3" /> 使用指南：
          </p>
          <p className="leading-relaxed opacity-90">
            点击任意图谱节点，将高亮其关联事件纽带，并可在右侧 Codx 设定集中同步查看或修改其原设事实。
          </p>
        </div>
      </div>
    </div>
  );
}
