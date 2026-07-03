/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, X, Sparkles, BookOpen } from 'lucide-react';

interface DiffViewerProps {
  originalText: string;
  proposedText: string;
  onAccept: () => void;
  onReject: () => void;
  title?: string;
}

export default function DiffViewer({
  originalText,
  proposedText,
  onAccept,
  onReject,
  title = "AI 创作提议审阅"
}: DiffViewerProps) {
  
  // A simple but effective paragraph-by-paragraph diff compiler for prose
  const originalParagraphs = originalText.split('\n').filter(p => p.trim());
  const proposedParagraphs = proposedText.split('\n').filter(p => p.trim());

  return (
    <div className="bg-stone-50 rounded-lg border-2 border-amber-600/30 shadow-md overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-700 to-stone-800 p-4 text-white flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <div>
            <h3 className="font-serif font-bold text-sm">{title}</h3>
            <p className="text-[10px] text-amber-200 font-mono">请仔细比对细节后决定是否采纳修改合并入正文</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="flex items-center gap-1 text-xs bg-black/30 hover:bg-black/55 text-stone-100 px-3 py-1.5 rounded transition font-mono font-medium"
          >
            <X className="w-3.5 h-3.5" /> 放弃更改
          </button>
          <button
            onClick={onAccept}
            className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-stone-950 px-4 py-1.5 rounded transition font-medium shadow-sm font-serif"
          >
            <Check className="w-3.5 h-3.5" /> 采用修改并合并
          </button>
        </div>
      </div>

      {/* Main Content Area: Split View */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-y-auto max-h-[480px]">
        {/* Left Column: Original Text */}
        <div className="flex flex-col h-full bg-white rounded border border-stone-200 p-4 shadow-inner">
          <div className="flex justify-between items-center pb-2 mb-3 border-b border-stone-100">
            <span className="font-serif font-bold text-xs text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
              原草稿 (Original Text)
            </span>
            <span className="text-[10.5px] text-stone-400 font-mono">字数: {originalText.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto text-[14.5px] leading-relaxed font-serif text-stone-600 space-y-3 select-none">
            {originalParagraphs.map((para, idx) => (
              <p key={idx} className="indent-8 bg-red-50/20 text-stone-600 line-through decoration-red-400/40 py-1 rounded px-1">
                {para}
              </p>
            ))}
            {originalParagraphs.length === 0 && (
              <p className="text-stone-400 italic text-center py-8">（选区原本为空）</p>
            )}
          </div>
        </div>

        {/* Right Column: AI Proposed Text */}
        <div className="flex flex-col h-full bg-white rounded border border-stone-200 p-4 shadow-inner">
          <div className="flex justify-between items-center pb-2 mb-3 border-b border-stone-100">
            <span className="font-serif font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
              AI 优化方案 (AI Proposal)
            </span>
            <span className="text-[10.5px] text-stone-400 font-mono">字数: {proposedText.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto text-[15px] leading-relaxed font-serif text-stone-800 space-y-3">
            {proposedParagraphs.map((para, idx) => (
              <p key={idx} className="indent-8 bg-emerald-50/30 text-stone-900 font-medium py-1 rounded px-1 border-l-2 border-emerald-500">
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
