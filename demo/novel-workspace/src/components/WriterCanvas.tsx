/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Chapter, ProjectSettings, CodexEntry } from '../types';
import { 
  Sparkles, 
  Edit, 
  RotateCcw, 
  Check, 
  AlignLeft, 
  Type, 
  Maximize2, 
  AlertTriangle, 
  FileText, 
  BarChart2, 
  Activity, 
  Play, 
  Settings2, 
  HelpCircle,
  Volume2,
  VolumeX,
  CloudRain,
  Waves,
  Flame,
  Wind,
  X,
  Keyboard,
  Info,
  ChevronDown,
  Eye,
  CheckCircle2,
  SlidersHorizontal,
  Bookmark
} from 'lucide-react';
import { zenSynth } from '../utils/audio';

interface WriterCanvasProps {
  chapter: Chapter;
  settings: ProjectSettings;
  onChangeChapterContent: (content: string) => void;
  onUpdateChapterTitle: (title: string) => void;
  onTriggerAI: (action: 'continue' | 'polish' | 'summarize' | 'extract' | 'diagnostic', params: { prompt?: string, selectedText?: string }) => void;
  isAiLoading: boolean;
  aiDiagnosticResult: any;
  onClearDiagnostics: () => void;
  codex: CodexEntry[];
  onUpdateSettings?: (settings: ProjectSettings) => void;
}

export default function WriterCanvas({
  chapter,
  settings,
  onChangeChapterContent,
  onUpdateChapterTitle,
  onTriggerAI,
  isAiLoading,
  aiDiagnosticResult,
  onClearDiagnostics,
  codex,
  onUpdateSettings,
}: WriterCanvasProps) {
  const [localContent, setLocalContent] = useState(chapter.content);
  const [localTitle, setLocalTitle] = useState(chapter.title);
  const [selection, setSelection] = useState({ start: 0, end: 0, text: '' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiToolbar, setShowAiToolbar] = useState(false);
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  // --- Aesthetic Customizations State ---
  const [activePreviewEntity, setActivePreviewEntity] = useState<CodexEntry | null>(null);
  const [zenEnabled, setZenEnabled] = useState(false);
  const [volumes, setVolumes] = useState({
    rain: 0.3,
    wave: 0.2,
    fire: 0.25,
    wind: 0.15
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when chapter changes
  useEffect(() => {
    setLocalContent(chapter.content);
    setLocalTitle(chapter.title);
    onClearDiagnostics();
    setShowDiagnosticPanel(false);
  }, [chapter.id]);

  // Cleanup zen audio on unmount
  useEffect(() => {
    return () => {
      zenSynth.stop();
    };
  }, []);

  // Handle auto save simulation
  useEffect(() => {
    if (localContent !== chapter.content) {
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        onChangeChapterContent(localContent);
        setSaveStatus('saved');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [localContent]);

  // Audio trigger for typewriter click on user keyboard typing
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (settings.typingSoundEnabled) {
      const isBackspace = e.key === 'Backspace' || e.key === 'Delete';
      zenSynth.playTypeClick(isBackspace);
    }
  };

  // Track selection for selection-based AI polishing
  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const text = target.value.substring(start, end);
    setSelection({ start, end, text });
    
    if (text.trim().length > 4) {
      setShowAiToolbar(true);
    } else {
      setShowAiToolbar(false);
    }
  };

  const handleContinueWriting = () => {
    onTriggerAI('continue', { prompt: aiPrompt });
    setAiPrompt('');
  };

  const handlePolishSelection = () => {
    if (!selection.text) return;
    onTriggerAI('polish', { prompt: aiPrompt, selectedText: selection.text });
    setAiPrompt('');
  };

  const handleSummarize = () => {
    onTriggerAI('summarize', {});
  };

  const handleExtractEntities = () => {
    onTriggerAI('extract', {});
  };

  const handleRunDiagnostics = () => {
    onTriggerAI('diagnostic', {});
    setShowDiagnosticPanel(true);
  };

  const fontThemeClass = () => {
    switch (settings.fontFamily) {
      case 'serif': return 'font-serif tracking-normal';
      case 'mono': return 'font-mono tracking-tight text-xs';
      default: return 'font-sans tracking-wide text-[15px]';
    }
  };

  // --- Zen Sound Toggle Controls ---
  const toggleZen = () => {
    const nextState = !zenEnabled;
    setZenEnabled(nextState);
    if (nextState) {
      zenSynth.start();
      zenSynth.setVolume('rain', volumes.rain);
      zenSynth.setVolume('wave', volumes.wave);
      zenSynth.setVolume('fire', volumes.fire);
      zenSynth.setVolume('wind', volumes.wind);
    } else {
      zenSynth.stop();
    }
  };

  const handleVolumeChange = (track: 'rain' | 'wave' | 'fire' | 'wind', val: number) => {
    const newVols = { ...volumes, [track]: val };
    setVolumes(newVols);
    if (zenEnabled) {
      zenSynth.setVolume(track, val);
    }
  };

  const handleThemeChange = (theme: 'parchment' | 'bamboo' | 'slate' | 'softcoal') => {
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, editorTheme: theme });
    }
  };

  const toggleTypewriterSound = () => {
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, typingSoundEnabled: !settings.typingSoundEnabled });
    }
  };

  // --- Dynamic L3 Codex Entity Scanner ---
  const getDetectedEntities = () => {
    if (!localContent) return [];
    const matches: CodexEntry[] = [];
    codex.forEach(entry => {
      // Check if any alias matches the text
      const found = entry.aliases.some(alias => 
        alias && alias.length > 1 && localContent.includes(alias)
      );
      if (found && !matches.some(m => m.id === entry.id)) {
        matches.push(entry);
      }
    });
    return matches;
  };

  const detectedEntities = getDetectedEntities();

  // --- Style Theme Presets ---
  const themes = {
    parchment: {
      bg: 'bg-[#FAF8F5]',
      panelBg: 'bg-[#FDFCF9]',
      text: 'text-stone-850',
      border: 'border-amber-900/10',
      titleText: 'text-stone-900',
      divider: 'border-stone-200',
      placeholder: 'placeholder:text-stone-300',
      manuscriptLine: 'border-red-900/10',
      statsBg: 'bg-amber-50/50 text-amber-900 border-amber-100',
      label: '宣纸雅致'
    },
    bamboo: {
      bg: 'bg-[#F2F6F0]',
      panelBg: 'bg-[#F7FAF5]',
      text: 'text-emerald-950',
      border: 'border-emerald-900/10',
      titleText: 'text-emerald-900',
      divider: 'border-emerald-200',
      placeholder: 'placeholder:text-emerald-300',
      manuscriptLine: 'border-emerald-800/10',
      statsBg: 'bg-emerald-50 text-emerald-900 border-emerald-100',
      label: '幽竹护眼'
    },
    slate: {
      bg: 'bg-[#141517]',
      panelBg: 'bg-[#1B1D20]',
      text: 'text-stone-300',
      border: 'border-stone-800',
      titleText: 'text-stone-100',
      divider: 'border-stone-850',
      placeholder: 'placeholder:text-stone-700',
      manuscriptLine: 'border-stone-800/40',
      statsBg: 'bg-stone-900 text-stone-300 border-stone-800',
      label: '深野水墨'
    },
    softcoal: {
      bg: 'bg-[#F5EFE6]',
      panelBg: 'bg-[#FAF6EE]',
      text: 'text-stone-800',
      border: 'border-amber-700/10',
      titleText: 'text-stone-900',
      divider: 'border-stone-200',
      placeholder: 'placeholder:text-amber-300',
      manuscriptLine: 'border-amber-800/10',
      statsBg: 'bg-[#EDE4D5] text-stone-800 border-amber-200/40',
      label: '晨曦暖阁'
    }
  };

  const activeThemeKey = settings.editorTheme || 'parchment';
  const theme = themes[activeThemeKey] || themes.parchment;

  // Word count dynamic calculations
  const totalWordCount = localContent.length;
  const wordTarget = 2000;
  const percentageOfTarget = Math.min(100, Math.round((totalWordCount / wordTarget) * 100));

  return (
    <div className={`flex flex-col h-full ${theme.bg} overflow-hidden relative transition-colors duration-300`}>
      
      {/* 1. Header Toolbar with Theme & Sound Quick Selectors */}
      <div className={`p-3 border-b ${theme.divider} ${theme.panelBg} flex justify-between items-center px-6 transition-colors duration-300 shadow-sm z-10`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={localTitle}
            onChange={(e) => {
              setLocalTitle(e.target.value);
              onUpdateChapterTitle(e.target.value);
            }}
            className={`font-serif font-bold ${theme.titleText} text-lg bg-transparent border-b border-transparent hover:border-stone-300 focus:border-amber-700 outline-none w-full max-w-[320px] py-1`}
          />
          <span className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${saveStatus === 'saved' ? 'text-emerald-700 border-emerald-200 bg-emerald-50/50' : 'text-amber-700 border-amber-200 bg-amber-50/50 animate-pulse'}`}>
            {saveStatus === 'saved' ? '● 已保存' : '● 保存中...'}
          </span>

          {/* Vertical Divider */}
          <span className="h-4 w-[1px] bg-stone-300/60 mx-1 shrink-0" />

          {/* Mini Theme Picker Buttons */}
          <div className="flex items-center gap-1.5 shrink-0" title="切换宣纸材质风格">
            {(Object.keys(themes) as Array<keyof typeof themes>).map((key) => {
              const th = themes[key];
              const isSelected = activeThemeKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleThemeChange(key)}
                  className={`w-4 h-4 rounded-full border shadow-2xs transition-all ${
                    key === 'parchment' ? 'bg-[#FAF8F5]' :
                    key === 'bamboo' ? 'bg-[#F2F6F0]' :
                    key === 'slate' ? 'bg-[#141517]' : 'bg-[#F5EFE6]'
                  } ${isSelected ? 'ring-2 ring-amber-600 border-white scale-110' : 'border-stone-300 hover:scale-105'}`}
                  title={th.label}
                />
              );
            })}
          </div>

          {/* Typing feedback sound button */}
          <button
            onClick={toggleTypewriterSound}
            className={`p-1.5 rounded-md transition border shrink-0 ${
              settings.typingSoundEnabled 
                ? 'bg-amber-100 text-amber-900 border-amber-200' 
                : 'text-stone-400 border-stone-200 hover:bg-stone-50'
            }`}
            title={settings.typingSoundEnabled ? '已开启打字机声效反馈' : '开启打字机声效反馈'}
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleRunDiagnostics}
            disabled={isAiLoading}
            className="flex items-center gap-1 text-[11px] border border-stone-200 bg-white hover:bg-stone-50 px-2.5 py-1.5 rounded text-stone-600 disabled:opacity-40 transition shadow-2xs"
            title="对章节进行全量多层逻辑健壮诊断"
          >
            <Activity className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
            <span className="font-serif font-medium">健壮性质检</span>
          </button>
          
          <button
            onClick={handleExtractEntities}
            disabled={isAiLoading}
            className="flex items-center gap-1 text-[11px] border border-stone-200 bg-white hover:bg-stone-50 px-2.5 py-1.5 rounded text-stone-600 disabled:opacity-40 transition shadow-2xs"
            title="提取本章全新设定角色、道具或地点"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-serif font-medium">智能抽卡</span>
          </button>

          <button
            onClick={handleSummarize}
            disabled={isAiLoading}
            className="flex items-center gap-1 text-[11px] border border-stone-200 bg-white hover:bg-stone-50 px-2.5 py-1.5 rounded text-stone-600 disabled:opacity-40 transition shadow-2xs"
            title="让 AI 沉淀物理进展，更新大纲与人物动态日志"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span className="font-serif font-medium">大纲提炼</span>
          </button>
        </div>
      </div>

      {/* 2. Matched L3 Entity memory HUD Ribbon (The delicate, glowing link) */}
      {detectedEntities.length > 0 && (
        <div className={`px-6 py-2 border-b ${theme.divider} ${theme.panelBg} flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none transition-all duration-300`}>
          <span className="text-[9px] font-mono font-bold uppercase text-stone-400 flex items-center gap-1">
            <Bookmark className="w-3 h-3 text-amber-600" />
            本章唤醒原设 (Active Memories HUD):
          </span>
          <div className="flex items-center gap-1.5">
            {detectedEntities.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setActivePreviewEntity(entry)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10.5px] shadow-3xs cursor-pointer transition-all hover:-translate-y-0.5 ${
                  entry.type === 'character' ? 'border-emerald-200 bg-emerald-50/75 text-emerald-950' :
                  entry.type === 'item' ? 'border-amber-200 bg-amber-50/75 text-amber-950' :
                  entry.type === 'location' ? 'border-sky-200 bg-sky-50/75 text-sky-950' : 'border-purple-200 bg-purple-50/75 text-purple-950'
                }`}
                title={`点击即刻审阅 ${entry.name} 的原始档案与境界历史`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                <span className="font-serif font-semibold">{entry.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Editor Main Canvas Split Pane */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Distraction-free Editorial Pad with manuscript guides */}
        <div className="flex-1 overflow-y-auto px-6 py-8 flex justify-center border-r border-stone-200/50 scrollbar-thin relative">
          
          {/* Subtle page paper-grid style decoration simulating authentic original manuscript book blocks */}
          <div
            style={{ maxWidth: `${settings.columnWidth}px` }}
            className={`w-full flex flex-col h-full space-y-4 p-8 md:p-12 rounded-lg border shadow-sm transition-all duration-300 ${theme.panelBg} ${theme.border} relative`}
          >
            {/* Visual Red Margin Line down the left simulating authentic Chinese manuscript notebooks (乌丝栏) */}
            <div className={`absolute left-4 top-0 bottom-0 border-l ${theme.manuscriptLine} pointer-events-none`} />
            <div className={`absolute right-4 top-0 bottom-0 border-r ${theme.manuscriptLine} pointer-events-none`} />

            {/* Word count target progress ring */}
            <div className="flex items-center justify-between text-[10.5px] font-mono text-stone-400 bg-stone-50/40 p-2.5 rounded-md border border-stone-150/40 relative z-10 select-none">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-stone-400" />
                <span>正文中提及的设定卡关键词会自动唤醒，并在上方召回状态列展现。</span>
              </span>
              <div className="flex items-center gap-2">
                <span>进度: <strong>{totalWordCount}</strong> / {wordTarget} 字</span>
                <div className="w-16 h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div className="bg-amber-600 h-full transition-all duration-500" style={{ width: `${percentageOfTarget}%` }} />
                </div>
                <span className="font-bold text-stone-600">{percentageOfTarget}%</span>
              </div>
            </div>

            {/* Content Textarea styled as cream manuscript paper */}
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onSelect={handleTextareaSelect}
              style={{
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
              }}
              placeholder="落雨纷飞，开始书写你的不朽篇章..."
              className={`flex-1 w-full bg-transparent border-none outline-none resize-none ${theme.text} ${fontThemeClass()} focus:ring-0 leading-relaxed placeholder:italic placeholder:text-stone-300/80 relative z-10`}
            />
          </div>
        </div>

        {/* Right Side: AI Assistant Side-Panel Actions & Zen Ambient Synth */}
        <div className="w-80 border-l border-stone-200 bg-stone-50/50 flex flex-col divide-y divide-stone-200 overflow-y-auto">
          
          {/* Section A: Zen Soundboard (禅意静修心境 - assetless Audio Synth) */}
          <div className="p-4 space-y-3.5 bg-white shadow-3xs">
            <div className="flex justify-between items-center">
              <h4 className="font-serif font-bold text-stone-800 text-xs flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-amber-700 animate-pulse" />
                禅意静修白噪音 (Zen Ambient Sound)
              </h4>
              <button
                onClick={toggleZen}
                className={`text-[10px] font-mono px-2 py-1 rounded transition flex items-center gap-1 ${
                  zenEnabled 
                    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200 font-bold' 
                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold'
                }`}
              >
                {zenEnabled ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                {zenEnabled ? '停止播放' : '播放静音'}
              </button>
            </div>

            <p className="text-[10px] text-stone-400 font-serif leading-relaxed">
              * 纯前端数学波形实时合成，不消耗任何网络流量。帮助您快速进入专注创作状态。
            </p>

            <div className="space-y-2.5 text-xs">
              {/* Rain */}
              <div className="space-y-1 bg-stone-50 p-2 rounded-md border border-stone-100">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="flex items-center gap-1 text-stone-600 font-serif">
                    <CloudRain className="w-3.5 h-3.5 text-indigo-500" />
                    雨打芭蕉 (Raindrop)
                  </span>
                  <span className="font-mono text-stone-400 text-[9px]">{Math.round(volumes.rain * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volumes.rain}
                  onChange={(e) => handleVolumeChange('rain', parseFloat(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                />
              </div>

              {/* Fire */}
              <div className="space-y-1 bg-stone-50 p-2 rounded-md border border-stone-100">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="flex items-center gap-1 text-stone-600 font-serif">
                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                    围炉柴爆 (Woodcrack)
                  </span>
                  <span className="font-mono text-stone-400 text-[9px]">{Math.round(volumes.fire * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volumes.fire}
                  onChange={(e) => handleVolumeChange('fire', parseFloat(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                />
              </div>

              {/* Waves */}
              <div className="space-y-1 bg-stone-50 p-2 rounded-md border border-stone-100">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="flex items-center gap-1 text-stone-600 font-serif">
                    <Waves className="w-3.5 h-3.5 text-cyan-500" />
                    沧海潮生 (Sea Waves)
                  </span>
                  <span className="font-mono text-stone-400 text-[9px]">{Math.round(volumes.wave * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volumes.wave}
                  onChange={(e) => handleVolumeChange('wave', parseFloat(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                />
              </div>

              {/* Wind */}
              <div className="space-y-1 bg-stone-50 p-2 rounded-md border border-stone-100">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="flex items-center gap-1 text-stone-600 font-serif">
                    <Wind className="w-3.5 h-3.5 text-emerald-500" />
                    空谷松涛 (Deep Forest)
                  </span>
                  <span className="font-mono text-stone-400 text-[9px]">{Math.round(volumes.wind * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volumes.wind}
                  onChange={(e) => handleVolumeChange('wind', parseFloat(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-700"
                />
              </div>
            </div>
          </div>

          {/* Section B: Selection-sensitive AI polish tool */}
          <div className="p-4 space-y-3 bg-white">
            <h4 className="font-serif font-bold text-stone-800 text-xs flex items-center gap-1">
              <Edit className="w-4 h-4 text-amber-700" />
              选区 AI 智臻润色 (In-place Polish)
            </h4>
            
            {selection.text ? (
              <div className="space-y-2">
                <div className="p-2 bg-stone-50 rounded border border-stone-100 text-[11px] text-stone-500 max-h-16 overflow-y-auto">
                  <span className="font-mono text-[9px] uppercase block font-semibold text-stone-400">选中的句子:</span>
                  <p className="font-serif italic">“{selection.text}”</p>
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-medium text-stone-400 mb-1">润色指示 (比如：增加动作描写，更具诗意)</label>
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="如：渲染悲凉的环境、提高打斗震撼力"
                    className="w-full text-xs p-2 border border-stone-200 rounded focus:outline-none focus:border-amber-600 bg-white"
                  />
                </div>
                <button
                  onClick={handlePolishSelection}
                  disabled={isAiLoading}
                  className="w-full py-1.5 bg-amber-700 text-amber-50 hover:bg-amber-800 rounded text-xs font-serif font-medium flex items-center justify-center gap-1 shadow-sm transition disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 对选区进行深度润色
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-stone-400 leading-relaxed font-serif">
                请在左侧编辑器中划选一段文字，即可自动唤醒选区局部润色工具，支持针对修辞、描写、战斗等维度的针对性重构。
              </p>
            )}
          </div>

          {/* Section C: Continuation Tool */}
          <div className="p-4 space-y-3 bg-white">
            <h4 className="font-serif font-bold text-stone-800 text-xs flex items-center gap-1">
              <Play className="w-4 h-4 text-emerald-700" />
              情节大方向续写 (AI Continuation)
            </h4>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] font-mono font-medium text-stone-400 mb-1">给 AI 的下文大纲线索（选填）</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="如：陆沉醒过来，发现林素微在用冷笑嘲讽他，随后他打听到天眼特工正在搜查贫民窟..."
                  className="w-full text-xs p-2 border border-stone-200 rounded focus:outline-none focus:border-amber-600 bg-white h-20 resize-none leading-relaxed font-serif"
                />
              </div>
              <button
                onClick={handleContinueWriting}
                disabled={isAiLoading}
                className="w-full py-2 bg-emerald-800 text-emerald-50 hover:bg-emerald-950 rounded text-xs font-serif font-medium flex items-center justify-center gap-1 shadow-sm transition disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5" /> 承接上文往下续写
              </button>
            </div>
          </div>

          {/* Section D: Diagnostic Panel Overlay/Drawer */}
          {showDiagnosticPanel && (
            <div className="p-4 space-y-3 bg-[#FFFBFB] text-xs border-t-2 border-rose-550">
              <div className="flex justify-between items-center">
                <h4 className="font-serif font-bold text-stone-800 text-xs flex items-center gap-1">
                  <BarChart2 className="w-4 h-4 text-rose-700" />
                  叙事健壮性诊断报告
                </h4>
                <button
                  onClick={() => {
                    onClearDiagnostics();
                    setShowDiagnosticPanel(false);
                  }}
                  className="text-[10px] text-stone-400 hover:text-stone-600 font-bold"
                >
                  关闭
                </button>
              </div>

              {isAiLoading ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-stone-300 border-t-rose-600 rounded-full animate-spin mx-auto" />
                  <p className="text-stone-400 font-serif text-[11px]">质检专家正在精细比对 L0 设定集与 L1 历史大纲...</p>
                </div>
              ) : aiDiagnosticResult ? (
                <div className="space-y-3">
                  {/* Score */}
                  <div className="p-2.5 bg-white border border-stone-200 rounded flex items-center justify-between">
                    <span className="font-serif font-medium text-stone-600">本章叙事节奏与水准评分:</span>
                    <strong className="text-lg font-mono text-rose-700">{aiDiagnosticResult.pacingScore || 85}分</strong>
                  </div>

                  {/* Violations List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {aiDiagnosticResult.violations && aiDiagnosticResult.violations.length > 0 ? (
                      aiDiagnosticResult.violations.map((vio: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-white border border-rose-100 rounded space-y-1 shadow-2xs">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-serif font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                              {vio.type}
                            </span>
                            <span className="text-amber-700 font-mono font-medium">{vio.severity}</span>
                          </div>
                          <p className="font-serif font-medium text-stone-700 leading-relaxed text-[11px]">{vio.description}</p>
                          <div className="bg-stone-50 p-1.5 rounded text-[10.5px] font-serif italic text-stone-500 border-l border-stone-300 mt-1">
                            <span className="font-serif font-bold text-stone-600 not-italic block text-[9.5px]">优化建议:</span>
                            {vio.suggestion}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center bg-white border border-stone-200 rounded italic text-stone-400 font-serif">
                        无明显逻辑矛盾或设定违背，故事健壮性极佳！
                      </div>
                    )}
                  </div>

                  {/* Review text */}
                  {aiDiagnosticResult.generalReview && (
                    <div className="p-2.5 bg-stone-100/50 rounded font-serif text-[11px] leading-relaxed text-stone-600">
                      <span className="font-serif font-bold text-stone-800 block text-xs mb-1">综合诊断结论：</span>
                      {aiDiagnosticResult.generalReview}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-stone-400 italic">请点击顶部“叙事健壮性质检”启动审核引擎...</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Active Memory L0 Facts Popup Card (Exquisite detail view) */}
      {activePreviewEntity && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-stone-200 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-fade-in">
            {/* Header */}
            <div className={`p-4 border-b border-stone-150 flex justify-between items-center ${activePreviewEntity.avatarColor || 'bg-stone-50'}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/90 border flex items-center justify-center font-serif font-extrabold text-sm text-stone-800">
                  {activePreviewEntity.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-900 text-sm">{activePreviewEntity.name}</h3>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-stone-500">{activePreviewEntity.type}</span>
                </div>
              </div>
              <button
                onClick={() => setActivePreviewEntity(null)}
                className="p-1 rounded-full text-stone-400 hover:bg-black/5 hover:text-stone-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
              {/* Description */}
              <div>
                <span className="block text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider mb-1">原始设定 (L0 Facts)</span>
                <p className="font-serif text-stone-800 bg-stone-50 p-3 rounded border border-stone-100 whitespace-pre-wrap text-[13px] leading-relaxed">
                  {activePreviewEntity.description}
                </p>
              </div>

              {/* Dynamic properties */}
              {activePreviewEntity.type === 'character' && (
                <div className="space-y-3 pt-2 border-t border-stone-100">
                  <span className="block text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider">实时状态快照</span>
                  
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-amber-50/50 border border-amber-100/50 p-2 rounded">
                      <span className="block text-[9px] font-mono text-stone-400">灵力境界</span>
                      <span className="font-serif font-bold text-stone-950 mt-0.5 block">{activePreviewEntity.dynamicState?.powerLevel || '未配置'}</span>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100/50 p-2 rounded">
                      <span className="block text-[9px] font-mono text-stone-400">目前地理位置</span>
                      <span className="font-serif font-bold text-stone-950 mt-0.5 block">{activePreviewEntity.dynamicState?.location || '未配置'}</span>
                    </div>
                  </div>

                  <div className="bg-stone-50 border border-stone-150 p-2.5 rounded text-[11px]">
                    <span className="block text-[9px] font-mono text-stone-400">生存/警戒状态</span>
                    <span className="font-serif text-stone-800 mt-1 block font-semibold">{activePreviewEntity.dynamicState?.status || '生命体征平稳'}</span>
                  </div>

                  {activePreviewEntity.currentState && (
                    <div className="bg-stone-50 border border-stone-150 p-2.5 rounded text-[11.5px]">
                      <span className="block text-[9px] font-mono text-stone-400">详细叙事记忆快照</span>
                      <p className="font-serif text-stone-700 mt-1 whitespace-pre-wrap">{activePreviewEntity.currentState}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-stone-50 p-3 border-t border-stone-150 flex justify-end">
              <button
                onClick={() => setActivePreviewEntity(null)}
                className="px-4 py-1.5 bg-stone-900 text-stone-100 rounded hover:bg-stone-950 text-xs font-mono font-medium transition"
              >
                关闭审阅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
