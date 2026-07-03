/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Chapter, CodexEntry } from '../types';
import { BookOpen, Plus, Trash2, ArrowUp, ArrowDown, Clock, MapPin, CheckSquare, Sparkles, ChevronDown, ChevronRight, Edit3 } from 'lucide-react';

interface SidebarChaptersProps {
  chapters: Chapter[];
  activeChapterId: string;
  onSelectChapter: (id: string) => void;
  onAddChapter: () => void;
  onDeleteChapter: (id: string) => void;
  onUpdateChapter: (chapter: Chapter) => void;
  codex: CodexEntry[];
}

export default function SidebarChapters({
  chapters,
  activeChapterId,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
  onUpdateChapter,
  codex,
}: SidebarChaptersProps) {
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState<string | null>(null);

  // Filter codex for locations
  const locations = codex.filter(item => item.type === 'location');

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

  const handleMoveUp = (chapter: Chapter, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === 0) return;
    const prevChapter = sortedChapters[index - 1];
    const originalOrder = chapter.order;
    
    onUpdateChapter({ ...chapter, order: prevChapter.order });
    onUpdateChapter({ ...prevChapter, order: originalOrder });
  };

  const handleMoveDown = (chapter: Chapter, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index === sortedChapters.length - 1) return;
    const nextChapter = sortedChapters[index + 1];
    const originalOrder = chapter.order;

    onUpdateChapter({ ...chapter, order: nextChapter.order });
    onUpdateChapter({ ...nextChapter, order: originalOrder });
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChapterId(expandedChapterId === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 border-r border-stone-200">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50/50">
        <div className="flex items-center gap-2 text-stone-800">
          <BookOpen className="w-5 h-5 text-amber-700" />
          <h2 className="font-serif font-semibold tracking-tight text-lg">大纲分卷章节</h2>
        </div>
        <button
          onClick={onAddChapter}
          className="flex items-center gap-1 text-xs bg-amber-700 text-amber-50 hover:bg-amber-800 px-2 py-1.5 rounded transition shadow-sm font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          新建章节
        </button>
      </div>

      {/* Chapters List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {sortedChapters.map((chapter, index) => {
          const isActive = chapter.id === activeChapterId;
          const isExpanded = expandedChapterId === chapter.id;
          const isEditing = isEditingMetadata === chapter.id;

          return (
            <div
              key={chapter.id}
              onClick={() => onSelectChapter(chapter.id)}
              className={`group relative rounded border transition-all cursor-pointer ${
                isActive
                  ? 'border-amber-600 bg-amber-50/40 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="p-3">
                {/* Title and Top Row */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <button
                      onClick={(e) => toggleExpand(chapter.id, e)}
                      className="text-stone-400 hover:text-stone-600 p-0.5 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <span className="font-mono text-[10px] bg-stone-100 text-stone-500 px-1 py-0.5 rounded">
                      Order {chapter.order}
                    </span>
                    <span className="font-serif font-medium text-stone-800 truncate text-sm">
                      {chapter.title || "未命名章节"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                    <button
                      disabled={index === 0}
                      onClick={(e) => handleMoveUp(chapter, index, e)}
                      className="p-1 rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-35"
                      title="上移"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={index === sortedChapters.length - 1}
                      onClick={(e) => handleMoveDown(chapter, index, e)}
                      className="p-1 rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-35"
                      title="下移"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChapter(chapter.id);
                      }}
                      className="p-1 rounded text-stone-400 hover:bg-stone-100 hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub Metadata (Story Time & Scene) */}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-500 font-mono items-center">
                  {chapter.storyTime && (
                    <div className="flex items-center gap-1" title="世界线剧情时间">
                      <Clock className="w-3 h-3 text-amber-600/70" />
                      <span>{chapter.storyTime}</span>
                    </div>
                  )}
                  {chapter.sceneDefIds && chapter.sceneDefIds.length > 0 && (
                    <div className="flex items-center gap-1" title="绑定的场景">
                      <MapPin className="w-3 h-3 text-emerald-600/70" />
                      <span>
                        {chapter.sceneDefIds
                          .map((id) => locations.find((l) => l.id === id)?.name || id)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible details (L1 Plot Summary & Events) */}
              {isExpanded && (
                <div
                  className="px-4 pb-4 pt-1 border-t border-stone-100 bg-stone-50/30 text-stone-700 text-xs space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Metadata Editor Form */}
                  {isEditing ? (
                    <div className="space-y-2 p-2.5 bg-white rounded border border-stone-200">
                      <div>
                        <label className="block text-[10px] font-mono font-medium text-stone-500 uppercase">章节名称</label>
                        <input
                          type="text"
                          value={chapter.title}
                          onChange={(e) => onUpdateChapter({ ...chapter, title: e.target.value })}
                          className="w-full text-xs p-1.5 border border-stone-200 rounded font-serif mt-0.5 focus:outline-none focus:border-amber-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-mono font-medium text-stone-500 uppercase">剧情时间 (Story Time)</label>
                          <input
                            type="text"
                            value={chapter.storyTime || ''}
                            placeholder="如：第1日 深夜"
                            onChange={(e) => onUpdateChapter({ ...chapter, storyTime: e.target.value })}
                            className="w-full text-xs p-1.5 border border-stone-200 rounded mt-0.5 focus:outline-none focus:border-amber-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono font-medium text-stone-500 uppercase">场景绑定 (Scene)</label>
                          <select
                            multiple
                            value={chapter.sceneDefIds || []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions).map((option) => (option as HTMLOptionElement).value);
                              onUpdateChapter({ ...chapter, sceneDefIds: selected });
                            }}
                            className="w-full text-xs p-1 border border-stone-200 rounded mt-0.5 focus:outline-none focus:border-amber-600 h-10 overflow-y-auto"
                          >
                            {locations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsEditingMetadata(null)}
                        className="w-full py-1 text-[11px] bg-stone-800 text-stone-100 rounded hover:bg-stone-900 transition mt-1 font-mono"
                      >
                        保存基本信息
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center bg-stone-100/50 p-1 px-2 rounded">
                      <span className="font-serif font-medium text-stone-600 text-[11px]">本章叙事上下文 (L1)</span>
                      <button
                        onClick={() => setIsEditingMetadata(chapter.id)}
                        className="flex items-center gap-1 text-[10px] font-mono text-amber-800 hover:text-amber-950 font-medium"
                      >
                        <Edit3 className="w-3 h-3" /> 编辑信息
                      </button>
                    </div>
                  )}

                  {/* L1 Summary */}
                  <div>
                    <h4 className="font-serif font-semibold text-stone-800 flex items-center gap-1 mb-1">
                      <Sparkles className="w-3 h-3 text-amber-700" />
                      章节大纲摘要
                    </h4>
                    <textarea
                      value={chapter.summary || ''}
                      placeholder="暂无本章大纲摘要。可通过右侧AI助手自动提炼生成..."
                      onChange={(e) => onUpdateChapter({ ...chapter, summary: e.target.value })}
                      className="w-full p-2 border border-stone-200 rounded bg-white font-serif text-[11.5px] leading-relaxed focus:outline-none focus:border-amber-600 h-16 resize-none"
                    />
                  </div>

                  {/* Key events list */}
                  <div>
                    <h4 className="font-serif font-semibold text-stone-800 flex items-center gap-1 mb-1.5">
                      <CheckSquare className="w-3 h-3 text-emerald-700" />
                      核心进展进展事件
                    </h4>
                    {chapter.keyEvents && chapter.keyEvents.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed text-stone-600 font-serif">
                        {chapter.keyEvents.map((event, idx) => (
                          <li key={idx}>
                            <input
                              type="text"
                              value={event}
                              onChange={(e) => {
                                const newEvents = [...(chapter.keyEvents || [])];
                                newEvents[idx] = e.target.value;
                                onUpdateChapter({ ...chapter, keyEvents: newEvents });
                              }}
                              className="bg-transparent border-b border-transparent hover:border-stone-300 focus:border-amber-600 outline-none w-full py-0.5 text-stone-600"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-stone-400 italic">点击AI章节提炼后自动在此沉淀物理事件线...</p>
                    )}
                    <button
                      onClick={() => {
                        const newEvents = [...(chapter.keyEvents || []), "新核心事件..."];
                        onUpdateChapter({ ...chapter, keyEvents: newEvents });
                      }}
                      className="mt-1 text-[10px] text-stone-400 hover:text-stone-600 hover:underline"
                    >
                      + 手动添加事件
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
