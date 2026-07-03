/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Chapter, CodexEntry, MemoryAudit, MemoryAuditEntry } from '../types';
import { BrainCircuit, Database, Layers, Search, Cpu, CheckCircle2, AlertTriangle, XCircle, Sparkles, HelpCircle } from 'lucide-react';

interface MemoryInspectorProps {
  audit: MemoryAudit;
  activeChapter: Chapter;
  codex: CodexEntry[];
}

export default function MemoryInspector({ audit, activeChapter, codex }: MemoryInspectorProps) {
  const [activeLayerFilter, setActiveLayerFilter] = useState<'all' | 'L0' | 'L1' | 'L2' | 'L3'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const layerMeta = {
    L0: { name: 'L0 实体设定卡', desc: '长期世界/人物原设，显式绑定场景与当前出场词检索', color: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200' },
    L1: { name: 'L1 剧情主线大纲', desc: '中长期情节脉络，按需对远期章节摘要做梯度压缩', color: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-indigo-200' },
    L2: { name: 'L2 风格上下文', desc: '短期工作内存，保留最新原汁原味正文保证行文连贯', color: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-200' },
    L3: { name: 'L3 联想记忆召回', desc: '联想召回池，通过正文同义词Alias匹配捕捉往昔线索', color: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-200' },
  };

  const filteredEntries = audit.entries.filter((entry) => {
    const matchesLayer = activeLayerFilter === 'all' || entry.layer === activeLayerFilter;
    const matchesSearch = entry.source.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          entry.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesLayer && matchesSearch;
  });

  const getStatusIcon = (status: MemoryAuditEntry['status']) => {
    switch (status) {
      case 'included': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'truncated': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'dropped': return <XCircle className="w-4 h-4 text-stone-300" />;
    }
  };

  const getStatusBadge = (status: MemoryAuditEntry['status']) => {
    switch (status) {
      case 'included': return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5 py-0.5 rounded font-medium">Included 选中</span>;
      case 'truncated': return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-medium">Truncated 截断</span>;
      case 'dropped': return <span className="bg-stone-50 text-stone-500 border border-stone-200 text-[10px] px-1.5 py-0.5 rounded font-medium">Dropped 丢弃</span>;
    }
  };

  // Find detected codex entries in the active chapter to explain L3 recall
  const detectedEntities = codex.filter(item => {
    const text = activeChapter.content.toLowerCase();
    return item.aliases.some(alias => text.includes(alias.toLowerCase()));
  });

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Title */}
      <div className="p-4 border-b border-stone-200 bg-stone-50/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-amber-800" />
          <h3 className="font-serif font-bold text-stone-950 text-sm">四层叙事记忆引擎看板 (Narrative Memory Audit)</h3>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs text-stone-500 bg-stone-100 px-2 py-1 rounded">
          <Cpu className="w-3.5 h-3.5 text-amber-700" />
          <span>估算总上下文大小: <strong className="text-stone-800">{Object.values(audit.sourceSummary).reduce((a,b)=>a+b, 0)}</strong> 字符</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Row 1: Layer Allocations Visualizer */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {(Object.keys(layerMeta) as Array<keyof typeof layerMeta>).map((key) => {
            const meta = layerMeta[key];
            const summary = audit.layerSummaries[key] || { size: 0, targetShare: 0.25, entryCount: 0, truncatedCount: 0, droppedCount: 0 };
            const percentage = Math.round((summary.size / Math.max(1, Object.values(audit.sourceSummary).reduce((a,b)=>a+b, 0))) * 100);

            return (
              <div key={key} className={`p-3.5 rounded border ${meta.border} bg-stone-50/50 flex flex-col justify-between space-y-3`}>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs bg-stone-200/60 px-1.5 py-0.5 rounded font-semibold text-stone-700">{key}</span>
                    <span className="font-mono text-xs font-bold text-stone-700">{percentage}% 份额</span>
                  </div>
                  <h4 className="font-serif font-bold text-stone-800 text-xs mt-1">{meta.name}</h4>
                  <p className="text-[10px] text-stone-500 leading-normal">{meta.desc}</p>
                </div>

                <div className="space-y-1.5">
                  {/* Gauge Bar */}
                  <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                    <div className={`${meta.color} h-1.5 rounded-full`} style={{ width: `${Math.min(100, percentage || 1)}%` }} />
                  </div>
                  
                  {/* Small stats */}
                  <div className="flex justify-between items-center text-[10px] text-stone-500 font-mono">
                    <span>装载: {summary.size} 字符</span>
                    <span>档案: {summary.entryCount}个</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* L3 Real-time triggers alert box */}
        <div className="p-3 bg-amber-50/30 border border-amber-100 rounded-md flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-700 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-serif font-bold text-amber-950">
              L3 关联记忆捕获诊断：本章正文共触发了 <strong className="text-amber-800 font-mono">{detectedEntities.length}</strong> 处 Codex 关键字关联
            </h4>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {detectedEntities.map((ent) => (
                <span
                  key={ent.id}
                  className="inline-flex items-center gap-1 text-[10px] font-serif bg-white text-stone-700 border border-stone-200/80 px-2 py-0.5 rounded-full"
                >
                  <Search className="w-2.5 h-2.5 text-purple-700" />
                  <strong>{ent.name}</strong>
                  <span className="text-[9px] text-stone-400 font-mono">({ent.aliases.slice(0, 2).join('/')})</span>
                </span>
              ))}
              {detectedEntities.length === 0 && (
                <span className="text-[10px] text-stone-400 italic">在当前章节中键入设定库中的角色名字或法宝名字（如：陆沉、承影飞剑），将自动唤醒它们的长期记忆。</span>
              )}
            </div>
          </div>
        </div>

        {/* Ledger Filter and search */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex gap-1.5 bg-stone-100 p-1 rounded-md">
              <button
                onClick={() => setActiveLayerFilter('all')}
                className={`text-[10.5px] font-mono px-2 py-1 rounded transition ${activeLayerFilter === 'all' ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-500 hover:text-stone-800'}`}
              >
                全部层级
              </button>
              {(['L0', 'L1', 'L2', 'L3'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setActiveLayerFilter(layer)}
                  className={`text-[10.5px] font-mono px-2 py-1 rounded transition ${activeLayerFilter === layer ? 'bg-white text-stone-900 shadow-xs font-semibold' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  {layer}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="搜索上下文档案源或内容..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs p-1.5 border border-stone-200 rounded w-full sm:w-56 focus:outline-none focus:border-amber-600 bg-stone-50"
            />
          </div>

          {/* Ledger Table */}
          <div className="border border-stone-200 rounded-md overflow-hidden bg-white">
            <table className="w-full text-left text-xs divide-y divide-stone-200">
              <thead className="bg-stone-50/70 text-stone-500 font-mono text-[10px] uppercase">
                <tr>
                  <th className="p-3">决策状态</th>
                  <th className="p-3">层级</th>
                  <th className="p-3">数据源档案名称</th>
                  <th className="p-3">类型</th>
                  <th className="p-3 text-right">估算长度 (字符)</th>
                  <th className="p-3">包含合理判定原因 (Explainable Audit)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-stone-50/40 transition">
                    <td className="p-3 flex items-center gap-2 font-medium">
                      {getStatusIcon(entry.status)}
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        entry.layer === 'L0' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                        entry.layer === 'L1' ? 'bg-indigo-50 text-indigo-800 border border-indigo-100' :
                        entry.layer === 'L2' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                        'bg-purple-50 text-purple-800 border border-purple-100'
                      }`}>
                        {entry.layer}
                      </span>
                    </td>
                    <td className="p-3 font-serif font-bold text-stone-800 text-[12.5px] max-w-[200px] truncate" title={entry.source}>
                      {entry.source}
                    </td>
                    <td className="p-3 font-mono text-[10px] text-stone-400 uppercase">
                      {entry.family}
                    </td>
                    <td className="p-3 text-right font-mono text-[11px] text-stone-600">
                      {entry.originalSize === entry.selectedSize ? (
                        <span>{entry.selectedSize}</span>
                      ) : (
                        <span title={`原长 ${entry.originalSize}`}>
                          {entry.selectedSize} <span className="text-[9px] text-stone-400">/{entry.originalSize}</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-stone-500 text-[11.5px] font-serif max-w-[300px] truncate" title={entry.reason || entry.content}>
                      {entry.reason || entry.content.substring(0, 50)}
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400 italic font-serif">
                      未找到符合筛选条件的记忆档案条目。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
