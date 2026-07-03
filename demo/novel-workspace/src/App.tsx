/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Chapter, CodexEntry, StateLog, PlotThread, ProjectSettings, MemoryAudit, MemoryAuditEntry, LayerSummary } from './types';
import {
  DEFAULT_SETTINGS,
  INITIAL_CHAPTERS,
  INITIAL_CODEX,
  INITIAL_PLOT_THREADS,
  INITIAL_STATE_LOGS,
} from './mockData';
import SidebarChapters from './components/SidebarChapters';
import SidebarCodex from './components/SidebarCodex';
import WriterCanvas from './components/WriterCanvas';
import MemoryInspector from './components/MemoryInspector';
import DiffViewer from './components/DiffViewer';
import RelationGraph from './components/RelationGraph';
import { callAIApi } from './utils/ai';
import {
  Settings,
  Brain,
  Network,
  Cpu,
  Sparkles,
  BookOpen,
  FolderDown,
  FolderUp,
  Sliders,
  X,
  FileCheck,
  CheckCircle,
  Eye,
  Info
} from 'lucide-react';

export default function App() {
  // --- Persistent Core State ---
  const [settings, setSettings] = useState<ProjectSettings>(() => {
    const saved = localStorage.getItem('novel_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [chapters, setChapters] = useState<Chapter[]>(() => {
    const saved = localStorage.getItem('novel_chapters');
    return saved ? JSON.parse(saved) : INITIAL_CHAPTERS;
  });

  const [activeChapterId, setActiveChapterId] = useState<string>(() => {
    const saved = localStorage.getItem('novel_active_chap');
    return saved || INITIAL_CHAPTERS[0].id;
  });

  const [codex, setCodex] = useState<CodexEntry[]>(() => {
    const saved = localStorage.getItem('novel_codex');
    return saved ? JSON.parse(saved) : INITIAL_CODEX;
  });

  const [stateLogs, setStateLogs] = useState<StateLog[]>(() => {
    const saved = localStorage.getItem('novel_state_logs');
    return saved ? JSON.parse(saved) : INITIAL_STATE_LOGS;
  });

  const [plotThreads, setPlotThreads] = useState<PlotThread[]>(() => {
    const saved = localStorage.getItem('novel_plot_threads');
    return saved ? JSON.parse(saved) : INITIAL_PLOT_THREADS;
  });

  // --- Runtime UI State ---
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);
  const [diffProposal, setDiffProposal] = useState<{
    original: string;
    proposed: string;
    action: 'continue' | 'polish';
    selectedText?: string;
  } | null>(null);
  
  const [aiDiagnosticResult, setAiDiagnosticResult] = useState<any | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [bottomTab, setBottomTab] = useState<'memory' | 'graph'>('memory');
  const [audit, setAudit] = useState<MemoryAudit>({
    layerSummaries: {},
    entries: [],
    sourceSummary: {},
  });

  // Save states to localStorage on change
  useEffect(() => {
    localStorage.setItem('novel_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('novel_chapters', JSON.stringify(chapters));
  }, [chapters]);

  useEffect(() => {
    localStorage.setItem('novel_active_chap', activeChapterId);
  }, [activeChapterId]);

  useEffect(() => {
    localStorage.setItem('novel_codex', JSON.stringify(codex));
  }, [codex]);

  useEffect(() => {
    localStorage.setItem('novel_state_logs', JSON.stringify(stateLogs));
  }, [stateLogs]);

  useEffect(() => {
    localStorage.setItem('novel_plot_threads', JSON.stringify(plotThreads));
  }, [plotThreads]);

  const activeChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0];

  // --- Dynamic Four-Layer Prompt Context Builder (PRD CORE) ---
  useEffect(() => {
    if (!activeChapter) return;

    const buildMemoryAudit = () => {
      const activeText = activeChapter.content.toLowerCase();
      const auditEntries: MemoryAuditEntry[] = [];
      const sourceSummary: Record<string, number> = {
        manuscript: 0,
        codex: 0,
        summary: 0,
        recall: 0,
        state: 0,
        thread: 0,
      };

      // 1. L2 - Recent Prose Compilation
      // We take the current chapter's content, and up to 1 previous chapter as style anchor
      const sortedChaps = [...chapters].sort((a, b) => a.order - b.order);
      const activeIndex = sortedChaps.findIndex((c) => c.id === activeChapter.id);
      
      let l2Text = activeChapter.content;
      auditEntries.push({
        id: `l2_${activeChapter.id}`,
        source: `${activeChapter.title} (L2 当前章节)`,
        family: 'manuscript',
        layer: 'L2',
        priority: 10,
        content: activeChapter.content,
        originalSize: activeChapter.content.length,
        selectedSize: activeChapter.content.length,
        status: 'included',
        reason: '当前章节正文，属于最优先短期工作内存，强制全量载入。',
      });
      sourceSummary.manuscript += activeChapter.content.length;

      if (activeIndex > 0) {
        const prevChap = sortedChaps[activeIndex - 1];
        l2Text = prevChap.content + "\n\n" + l2Text;
        auditEntries.push({
          id: `l2_prev_${prevChap.id}`,
          source: `${prevChap.title} (L2 前置章)`,
          family: 'manuscript',
          layer: 'L2',
          priority: 9,
          content: prevChap.content,
          originalSize: prevChap.content.length,
          selectedSize: prevChap.content.length,
          status: 'included',
          reason: '前置邻近章节，保障行文节奏、语境以及修辞连续性。',
        });
        sourceSummary.manuscript += prevChap.content.length;
      }

      // 2. L0 - Codex Facts Compilation
      // Includes locations explicitly linked to active chapter, and other entities matched in current text
      codex.forEach((item) => {
        const isLinkedLocation = activeChapter.sceneDefIds?.includes(item.id);
        const hasKeywordMatch = item.aliases.some((alias) => activeText.includes(alias.toLowerCase()));

        if (isLinkedLocation || hasKeywordMatch) {
          const itemContent = `[${item.name}设定卡] 类别: ${item.type}. 触发词: ${item.aliases.join('/')}. 原设背景: ${item.description}` + 
            (item.currentState ? ` 当前生存状态: ${item.currentState}` : '');
          
          auditEntries.push({
            id: `l0_${item.id}`,
            source: `${item.name} (${item.type === 'character' ? 'L0 角色卡' : item.type === 'item' ? 'L0 道具法宝' : 'L0 场景地理'})`,
            family: 'codex',
            layer: 'L0',
            priority: isLinkedLocation ? 8 : 7,
            content: itemContent,
            originalSize: itemContent.length,
            selectedSize: itemContent.length,
            status: 'included',
            reason: isLinkedLocation 
              ? '本章明确绑定的场景，强制做基础事实载入。'
              : `正文提及触发词“${item.name}”，L0设定库被实时唤醒提取。`,
          });
          sourceSummary.codex += itemContent.length;
        } else {
          // Cards not matched or linked are dropped from active budget
          const itemContent = `[${item.name}]`;
          auditEntries.push({
            id: `l0_drop_${item.id}`,
            source: `${item.name} (${item.type})`,
            family: 'codex',
            layer: 'L0',
            priority: 1,
            content: itemContent,
            originalSize: itemContent.length,
            selectedSize: 0,
            status: 'dropped',
            reason: '本章正文未触发设定别称，自愿退场不侵占上下文额度。',
          });
        }
      });

      // 3. L1 - Plot Summaries
      // Preceding chapters summaries
      sortedChaps.forEach((chap) => {
        if (chap.order < activeChapter.order) {
          const summaryContent = `[第${chap.order}章《${chap.title}》大纲提炼]: ${chap.summary || '（暂无摘要）'}`;
          auditEntries.push({
            id: `l1_${chap.id}`,
            source: `${chap.title} (L1 历史大纲)`,
            family: 'summary',
            layer: 'L1',
            priority: 5,
            content: summaryContent,
            originalSize: summaryContent.length,
            selectedSize: summaryContent.length,
            status: 'included',
            reason: '前置章节大纲梗概，维持中长期故事走向和因果逻辑连续。',
          });
          sourceSummary.summary += summaryContent.length;
        }
      });

      // 4. L3 - Dynamic Recall Engine Matches
      // Emulating local associative query searches
      codex.forEach((item) => {
        const hasKeywordMatch = item.aliases.some((alias) => activeText.includes(alias.toLowerCase()));
        if (hasKeywordMatch && item.type === 'character') {
          // Check if there are confirmed state logs for this character and append them to L3 context
          const characterLogs = stateLogs.filter(log => log.characterId === item.id);
          characterLogs.forEach((log) => {
            const logContent = `[L3 记忆重组] 角色 [${item.name}] 在Chapter ${log.chapterId.replace('chap_','')} 确认属性变更: ${log.key} -> ${log.value}`;
            auditEntries.push({
              id: `l3_log_${log.id}`,
              source: `${item.name} - [${log.key}] 变更履历 (L3 动态召回)`,
              family: 'state',
              layer: 'L3',
              priority: 6,
              content: logContent,
              originalSize: logContent.length,
              selectedSize: logContent.length,
              status: 'included',
              reason: 'L3 关联属性追溯：在正文提及该人物时，历史确认状态快照自动召回归档，杜绝设定冲突。',
            });
            sourceSummary.state += logContent.length;
          });
        }
      });

      // Compile layer summaries metrics
      const layerSummaries: Record<string, LayerSummary> = {
        L0: { layer: 'L0', size: 0, targetShare: 0.25, entryCount: 0, truncatedCount: 0, droppedCount: 0 },
        L1: { layer: 'L1', size: 0, targetShare: 0.20, entryCount: 0, truncatedCount: 0, droppedCount: 0 },
        L2: { layer: 'L2', size: 0, targetShare: 0.40, entryCount: 0, truncatedCount: 0, droppedCount: 0 },
        L3: { layer: 'L3', size: 0, targetShare: 0.15, entryCount: 0, truncatedCount: 0, droppedCount: 0 },
      };

      auditEntries.forEach((entry) => {
        const summary = layerSummaries[entry.layer];
        if (entry.status === 'included') {
          summary.size += entry.selectedSize;
          summary.entryCount += 1;
        } else if (entry.status === 'dropped') {
          summary.droppedCount += 1;
        } else if (entry.status === 'truncated') {
          summary.size += entry.selectedSize;
          summary.truncatedCount += 1;
        }
      });

      setAudit({
        layerSummaries,
        entries: auditEntries,
        sourceSummary,
      });
    };

    buildMemoryAudit();
  }, [chapters, activeChapterId, codex, stateLogs, plotThreads]);

  // --- Handlers for Outlines / Chapters ---
  const handleSelectChapter = (id: string) => {
    setActiveChapterId(id);
  };

  const handleAddChapter = () => {
    const nextOrder = chapters.length > 0 ? Math.max(...chapters.map((c) => c.order)) + 1 : 1;
    const newId = `chap_${Date.now()}`;
    const newChapter: Chapter = {
      id: newId,
      title: `第${nextOrder}章：新章节大纲`,
      content: '雨声渐密，风穿过废墟。在此开始书写你的下一段故事……',
      order: nextOrder,
      storyTime: `第${nextOrder}日`,
      summary: '',
      keyEvents: [],
      charactersInvolved: [],
      sceneDefIds: [],
    };
    setChapters([...chapters, newChapter]);
    setActiveChapterId(newId);
    showSuccessToast("成功创建新章节并载入编辑版面！");
  };

  const handleDeleteChapter = (id: string) => {
    if (chapters.length <= 1) {
      alert("大纲内至少需要保留一章草稿！");
      return;
    }
    const filtered = chapters.filter((c) => c.id !== id);
    setChapters(filtered);
    if (activeChapterId === id) {
      setActiveChapterId(filtered[0].id);
    }
    showSuccessToast("已安全删除该章大纲草稿。");
  };

  const handleUpdateChapter = (updated: Chapter) => {
    setChapters(chapters.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleUpdateActiveChapterContent = (newContent: string) => {
    if (!activeChapter) return;
    handleUpdateChapter({
      ...activeChapter,
      content: newContent,
    });
  };

  const handleUpdateActiveChapterTitle = (newTitle: string) => {
    if (!activeChapter) return;
    handleUpdateChapter({
      ...activeChapter,
      title: newTitle,
    });
  };

  // --- Handlers for Codex Card settings ---
  const handleAddCodexEntry = (entry: CodexEntry) => {
    setCodex([...codex, entry]);
    showSuccessToast(`已成功沉淀设定：[${entry.name}] 档案加入设定集。`);
  };

  const handleUpdateCodexEntry = (entry: CodexEntry) => {
    setCodex(codex.map((item) => (item.id === entry.id ? entry : item)));
    showSuccessToast(`已成功保存设定：[${entry.name}]。`);
  };

  const handleDeleteCodexEntry = (id: string) => {
    const entry = codex.find((item) => item.id === id);
    setCodex(codex.filter((item) => item.id !== id));
    showSuccessToast(`已成功删除设定：[${entry?.name || '未知'}]。`);
  };

  // --- Core AI Orchestrator Pipelines ---
  const handleTriggerAI = async (
    action: 'continue' | 'polish' | 'summarize' | 'extract' | 'diagnostic',
    params: { prompt?: string; selectedText?: string }
  ) => {
    setIsAiLoading(true);
    setAiError(null);
    setAiSuccessMessage(null);

    try {
      // 1. Gather context under our four-layer memory rules
      const l0String = audit.entries
        .filter((e) => e.layer === 'L0' && e.status === 'included')
        .map((e) => e.content)
        .join('\n');
      
      const l1String = audit.entries
        .filter((e) => e.layer === 'L1' && e.status === 'included')
        .map((e) => e.content)
        .join('\n');

      const response = await callAIApi(action, {
        content: activeChapter.content,
        prompt: params.prompt,
        selectedText: params.selectedText,
        title: activeChapter.title,
        context: {
          l0: l0String,
          l1: l1String,
        },
      });

      // 2. Action routing and reactive UI patch state
      if (action === 'continue') {
        setDiffProposal({
          original: activeChapter.content,
          proposed: activeChapter.content + "\n\n" + response.text,
          action: 'continue',
        });
      } 
      else if (action === 'polish') {
        setDiffProposal({
          original: params.selectedText || '',
          proposed: response.text,
          action: 'polish',
          selectedText: params.selectedText,
        });
      } 
      else if (action === 'summarize') {
        // Summary JSON contains outline summaries & character dynamic states
        const { summary, keyEvents, characterStates } = response;

        // Apply L1 Update
        handleUpdateChapter({
          ...activeChapter,
          summary: summary || activeChapter.summary,
          keyEvents: keyEvents || activeChapter.keyEvents,
        });

        // Push state changes as confirmed dynamic logs and update Codex
        if (characterStates && characterStates.length > 0) {
          const newLogs: StateLog[] = [];
          const updatedCodex = [...codex];

          characterStates.forEach((state: any, index: number) => {
            const charId = state.characterId || `char_${Date.now()}_${index}`;
            const logItem: StateLog = {
              id: `log_${Date.now()}_${index}`,
              characterId: charId,
              chapterId: activeChapter.id,
              key: '生存状态变更',
              value: state.stateChange,
              timestamp: new Date().toISOString(),
            };
            newLogs.push(logItem);

            // Update respective character's current state field in Codex
            const codexIdx = updatedCodex.findIndex((c) => c.id === charId);
            if (codexIdx >= 0) {
              updatedCodex[codexIdx] = {
                ...updatedCodex[codexIdx],
                currentState: state.stateChange,
              };
            }
          });

          setStateLogs([...newLogs, ...stateLogs]);
          setCodex(updatedCodex);
        }

        showSuccessToast("✨ 章节摘要分析成功！大纲、重大进展、及出场角色动态设定已被精细更新。");
      } 
      else if (action === 'extract') {
        // Entity extraction results JSON
        const { extractedEntities } = response;
        if (extractedEntities && extractedEntities.length > 0) {
          const newEntities: CodexEntry[] = [];
          extractedEntities.forEach((ent: any, idx: number) => {
            // Check if it already exists by name
            const exists = codex.some((c) => c.name === ent.name);
            if (!exists) {
              const colors = [
                'bg-amber-100 text-amber-800 border-amber-300',
                'bg-cyan-100 text-cyan-800 border-cyan-300',
                'bg-emerald-100 text-emerald-800 border-emerald-300',
                'bg-purple-100 text-purple-800 border-purple-300',
              ];
              const randomColor = colors[Math.floor(Math.random() * colors.length)];

              newEntities.push({
                id: `${ent.type || 'item'}_${Date.now()}_${idx}`,
                name: ent.name,
                type: ent.type || 'item',
                aliases: ent.aliases || [ent.name],
                description: ent.description || '自动提取的新设定描述...',
                avatarColor: randomColor,
                currentState: ent.currentState || undefined,
              });
            }
          });

          if (newEntities.length > 0) {
            setCodex([...codex, ...newEntities]);
            showSuccessToast(`✨ 成功从文本中提取出 ${newEntities.length} 个全新设定卡（${newEntities.map(e=>e.name).join(', ')}）！`);
          } else {
            showSuccessToast("章节中未发现明显区别于现有卡片的新实体设定。");
          }
        } else {
          showSuccessToast("章节中未发现明显区别于现有卡片的新实体设定。");
        }
      } 
      else if (action === 'diagnostic') {
        setAiDiagnosticResult(response);
        showSuccessToast("🔍 叙事健壮性质检报告已成功生成，请在右侧诊断抽屉中审阅冲突。");
      }

    } catch (err: any) {
      console.error("AI execution failed:", err);
      setAiError(err.message || "连接服务器超时，请确保右上角设置中 API 密钥配置正确。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Accept diff proposal from AI and merge into active draft
  const handleAcceptProposal = () => {
    if (!diffProposal) return;

    if (diffProposal.action === 'continue') {
      handleUpdateActiveChapterContent(diffProposal.proposed);
      showSuccessToast("✅ 续写段落已被顺利采用并并入章节。");
    } else if (diffProposal.action === 'polish' && diffProposal.selectedText) {
      // Find and replace the polished selection
      const updatedText = activeChapter.content.replace(diffProposal.original, diffProposal.proposed);
      handleUpdateActiveChapterContent(updatedText);
      showSuccessToast("✅ 划选局部润色已成功更新并替换。");
    }
    setDiffProposal(null);
  };

  const handleRejectProposal = () => {
    setDiffProposal(null);
    showSuccessToast("已放弃 AI 优化方案，保留了您的原稿。");
  };

  const showSuccessToast = (msg: string) => {
    setAiSuccessMessage(msg);
    setTimeout(() => setAiSuccessMessage(null), 4000);
  };

  const handleExportProject = () => {
    const payload = {
      settings,
      chapters,
      codex,
      stateLogs,
      plotThreads
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${settings.title || 'Novel_Project'}_备份导出.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showSuccessToast("项目全量工程文件（大纲、设定卡、正文、履历）已成功打包导出备份！");
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-stone-100 overflow-hidden text-stone-800 selection:bg-amber-200">
      
      {/* 1. Primary Application Header */}
      <header className="h-14 bg-stone-900 text-stone-100 px-6 flex justify-between items-center shrink-0 border-b border-stone-950 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center border border-amber-500 shadow-inner">
            <BookOpen className="w-4.5 h-4.5 text-stone-900" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-sm tracking-tight text-stone-100 flex items-center gap-1.5">
              <span>{settings.title}</span>
              <span className="font-sans text-[10px] font-medium bg-stone-800 text-amber-500 px-2 py-0.5 rounded border border-amber-600/30">
                Novel Workspace v1.2
              </span>
            </h1>
            <p className="text-[10px] text-stone-400 font-mono tracking-wide">
              {settings.genre} · 作者: {settings.author}
            </p>
          </div>
        </div>

        {/* Global Action items */}
        <div className="flex items-center gap-2">
          {aiError && (
            <div className="bg-red-950/60 text-red-300 text-xs px-3 py-1.5 rounded border border-red-800 flex items-center gap-1.5 max-w-[400px] truncate animate-bounce">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>{aiError}</span>
              <button onClick={() => setAiError(null)} className="text-red-400 hover:text-red-200 text-xs pl-1">×</button>
            </div>
          )}

          {aiSuccessMessage && (
            <div className="bg-stone-850 text-amber-400 text-[11px] font-serif px-3.5 py-1.5 rounded border border-amber-600/20 shadow-lg flex items-center gap-2 animate-fade-in">
              <CheckCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>{aiSuccessMessage}</span>
            </div>
          )}

          <button
            onClick={handleExportProject}
            className="flex items-center gap-1 text-[11px] font-mono bg-stone-800 hover:bg-stone-750 text-stone-300 px-3 py-2 rounded transition border border-stone-700"
            title="全量打包导出为 JSON 备份文件"
          >
            <FolderDown className="w-3.5 h-3.5" />
            备份导出
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1 text-[11px] font-mono bg-amber-700 hover:bg-amber-800 text-white px-3 py-2 rounded transition shadow-sm font-medium"
          >
            <Sliders className="w-3.5 h-3.5" />
            排版与创作设置
          </button>
        </div>
      </header>

      {/* 2. Core Workspace Area (Three-Column Layout) */}
      <main className="flex-1 flex overflow-hidden min-h-0 bg-stone-100">
        
        {/* Left column: Outline Chapters Tree */}
        <div className="w-72 shrink-0 h-full">
          <SidebarChapters
            chapters={chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={handleSelectChapter}
            onAddChapter={handleAddChapter}
            onDeleteChapter={handleDeleteChapter}
            onUpdateChapter={handleUpdateChapter}
            codex={codex}
          />
        </div>

        {/* Center column: Paper Editor Canvas & Diagnostics */}
        <div className="flex-1 h-full flex flex-col overflow-hidden min-w-0 bg-white shadow-xs">
          {/* Diff Proposal Overlay if AI has code suggestion */}
          {diffProposal ? (
            <div className="p-4 bg-stone-100 border-b border-stone-200 h-96 shrink-0 z-30 animate-fade-in shadow-xs">
              <DiffViewer
                originalText={diffProposal.original}
                proposedText={diffProposal.proposed}
                onAccept={handleAcceptProposal}
                onReject={handleRejectProposal}
                title={diffProposal.action === 'continue' ? 'AI 续写段落提议审阅' : 'AI 局部智臻润色提议审阅'}
              />
            </div>
          ) : null}

          {/* Core Writing Canvas */}
          <div className="flex-1 relative min-h-0">
            {isAiLoading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-20 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-stone-300 border-t-amber-700 rounded-full animate-spin" />
                <p className="text-xs font-serif text-stone-600">正在组装四层叙事上下文并安全提请 Gemini AI 协同...</p>
              </div>
            )}
            
            <WriterCanvas
              chapter={activeChapter}
              settings={settings}
              onChangeChapterContent={handleUpdateActiveChapterContent}
              onUpdateChapterTitle={handleUpdateActiveChapterTitle}
              onTriggerAI={handleTriggerAI}
              isAiLoading={isAiLoading}
              aiDiagnosticResult={aiDiagnosticResult}
              onClearDiagnostics={() => setAiDiagnosticResult(null)}
              codex={codex}
            />
          </div>
        </div>

        {/* Right column: Codex Setup cards */}
        <div className="w-80 shrink-0 h-full">
          <SidebarCodex
            codex={codex}
            stateLogs={stateLogs}
            onAddCodexEntry={handleAddCodexEntry}
            onUpdateCodexEntry={handleUpdateCodexEntry}
            onDeleteCodexEntry={handleDeleteCodexEntry}
          />
        </div>

      </main>

      {/* 3. Collapsible Diagnostics and Story Graph Drawer (Bottom Panel) */}
      <footer className="h-96 shrink-0 bg-stone-100 border-t border-stone-300 flex flex-col overflow-hidden shadow-2xl relative z-10">
        
        {/* Toggle headers */}
        <div className="h-10 bg-stone-200 border-b border-stone-300 px-6 flex justify-between items-center select-none shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setBottomTab('memory')}
              className={`flex items-center gap-1.5 text-[11px] py-1 px-3 rounded-t-md font-medium font-mono transition border-x border-t ${
                bottomTab === 'memory'
                  ? 'bg-white text-stone-900 border-stone-300 font-bold -mb-[11px]'
                  : 'text-stone-500 hover:text-stone-800 border-transparent hover:bg-stone-300/40'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-amber-700" />
              四层记忆引擎看板
            </button>
            <button
              onClick={() => setBottomTab('graph')}
              className={`flex items-center gap-1.5 text-[11px] py-1 px-3 rounded-t-md font-medium font-mono transition border-x border-t ${
                bottomTab === 'graph'
                  ? 'bg-white text-stone-900 border-stone-300 font-bold -mb-[11px]'
                  : 'text-stone-500 hover:text-stone-800 border-transparent hover:bg-stone-300/40'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-amber-700" />
              故事图谱网络图
            </button>
          </div>
          
          <div className="text-[10px] text-stone-400 font-serif italic">
            {bottomTab === 'memory' ? 'L0世界原设 · L1大纲连续 · L2行文风格 · L3召回联想' : '实体关联连线·点击可双向追溯'}
          </div>
        </div>

        {/* Tab contents */}
        <div className="flex-1 min-h-0 bg-white">
          {bottomTab === 'memory' ? (
            <div className="h-full p-2 bg-stone-50">
              <MemoryInspector
                audit={audit}
                activeChapter={activeChapter}
                codex={codex}
              />
            </div>
          ) : (
            <div className="h-full p-2 bg-stone-50">
              <RelationGraph
                codex={codex}
                onSelectNode={(id) => {
                  // Codex is handled in sidebar, click handles highlight and focuses state
                }}
              />
            </div>
          )}
        </div>
      </footer>

      {/* 4. Configuration Layout settings Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-stone-300 shadow-2xl p-6 w-[450px] space-y-4 font-serif">
            <div className="flex justify-between items-center border-b border-stone-100 pb-2">
              <h3 className="font-bold text-stone-900 text-sm font-serif">排版与创作偏好配置</h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 font-serif">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">作品总标题</label>
                  <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                    className="w-full p-2 border border-stone-200 rounded text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">作者署名</label>
                  <input
                    type="text"
                    value={settings.author}
                    onChange={(e) => setSettings({ ...settings, author: e.target.value })}
                    className="w-full p-2 border border-stone-200 rounded text-stone-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">故事题材风格</label>
                <input
                  type="text"
                  value={settings.genre}
                  onChange={(e) => setSettings({ ...settings, genre: e.target.value })}
                  className="w-full p-2 border border-stone-200 rounded"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">文稿字体主题</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => setSettings({ ...settings, fontFamily: e.target.value as any })}
                  className="w-full p-2 border border-stone-200 rounded font-serif text-xs bg-white focus:outline-none focus:border-amber-700"
                >
                  <option value="serif">古典古雅宣纸 优雅宋体 (Serif - Elegant Editorial)</option>
                  <option value="sans">现代清爽墨纸 简约黑体 (Sans - Minimal Clean)</option>
                  <option value="mono">赛博极客冷金 极客等宽 (Mono - Cyber technical)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">正文字号大小 (px)</label>
                  <input
                    type="number"
                    value={settings.fontSize}
                    min={12}
                    max={26}
                    onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) || 18 })}
                    className="w-full p-2 border border-stone-200 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">正文行间距 (Line Height)</label>
                  <input
                    type="number"
                    value={settings.lineHeight}
                    min={1.2}
                    max={2.5}
                    step={0.1}
                    onChange={(e) => setSettings({ ...settings, lineHeight: parseFloat(e.target.value) || 1.8 })}
                    className="w-full p-2 border border-stone-200 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">宣纸页边列宽 (Max Width - px)</label>
                <input
                  type="number"
                  value={settings.columnWidth}
                  min={500}
                  max={1000}
                  step={50}
                  onChange={(e) => setSettings({ ...settings, columnWidth: parseInt(e.target.value) || 700 })}
                  className="w-full p-2 border border-stone-200 rounded font-mono"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setShowConfigModal(false);
                showSuccessToast("排版偏好已成功更新。");
              }}
              className="w-full py-2 bg-stone-900 text-stone-100 rounded hover:bg-stone-950 transition font-mono font-bold text-xs"
            >
              应用所有并保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
