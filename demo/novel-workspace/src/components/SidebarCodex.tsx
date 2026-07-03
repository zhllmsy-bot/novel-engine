/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CodexEntry, StateLog } from '../types';
import { Users, Shield, Compass, Swords, Plus, Trash2, Edit, Save, PlusCircle, Activity, Bookmark, Eye, Check } from 'lucide-react';

interface SidebarCodexProps {
  codex: CodexEntry[];
  stateLogs: StateLog[];
  onAddCodexEntry: (entry: CodexEntry) => void;
  onUpdateCodexEntry: (entry: CodexEntry) => void;
  onDeleteCodexEntry: (id: string) => void;
}

type TabType = 'character' | 'item' | 'location' | 'faction';

export default function SidebarCodex({
  codex,
  stateLogs,
  onAddCodexEntry,
  onUpdateCodexEntry,
  onDeleteCodexEntry,
}: SidebarCodexProps) {
  const [activeTab, setActiveTab] = useState<TabType>('character');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form State
  const [editName, setEditName] = useState('');
  const [editAliases, setEditAliases] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCurrentState, setEditCurrentState] = useState('');
  const [editPower, setEditPower] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const filteredCodex = codex.filter((entry) => entry.type === activeTab);
  const selectedEntry = codex.find((entry) => entry.id === selectedEntryId) || filteredCodex[0];

  const handleSelectEntry = (entry: CodexEntry) => {
    setSelectedEntryId(entry.id);
    setIsEditing(false);
    fillForm(entry);
  };

  const fillForm = (entry: CodexEntry) => {
    if (!entry) return;
    setEditName(entry.name);
    setEditAliases(entry.aliases.join(', '));
    setEditDescription(entry.description);
    setEditCurrentState(entry.currentState || '');
    setEditPower(entry.dynamicState?.powerLevel || '');
    setEditLocation(entry.dynamicState?.location || '');
    setEditStatus(entry.dynamicState?.status || '');
  };

  // Sync state if selection changes on tab switch
  React.useEffect(() => {
    if (filteredCodex.length > 0 && (!selectedEntry || selectedEntry.type !== activeTab)) {
      handleSelectEntry(filteredCodex[0]);
    }
  }, [activeTab]);

  // Handle first load
  React.useEffect(() => {
    if (selectedEntry && !editName) {
      fillForm(selectedEntry);
    }
  }, [selectedEntry]);

  const handleAddNew = () => {
    const newId = `${activeTab}_${Date.now()}`;
    const colors = [
      'bg-amber-100 text-amber-800 border-amber-300',
      'bg-cyan-100 text-cyan-800 border-cyan-300',
      'bg-emerald-100 text-emerald-800 border-emerald-300',
      'bg-purple-100 text-purple-800 border-purple-300',
      'bg-rose-100 text-rose-800 border-rose-300',
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newEntry: CodexEntry = {
      id: newId,
      name: `新${activeTab === 'character' ? '角色' : activeTab === 'item' ? '道具' : activeTab === 'location' ? '场景' : '势力'}`,
      type: activeTab,
      aliases: [],
      description: '在此输入设定描述...',
      avatarColor: randomColor,
      currentState: activeTab === 'character' ? '初始状态：正常。' : undefined,
      dynamicState: activeTab === 'character' ? {
        location: '',
        powerLevel: '',
        status: '正常',
      } : undefined,
    };

    onAddCodexEntry(newEntry);
    setSelectedEntryId(newEntry.id);
    setIsEditing(true);
    fillForm(newEntry);
  };

  const handleSave = () => {
    if (!selectedEntry) return;

    const aliasList = editAliases
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    // Make sure the entry's primary name is in aliases for auto recall
    if (!aliasList.includes(editName)) {
      aliasList.unshift(editName);
    }

    const updated: CodexEntry = {
      ...selectedEntry,
      name: editName,
      aliases: aliasList,
      description: editDescription,
      currentState: activeTab === 'character' ? editCurrentState : undefined,
      dynamicState: activeTab === 'character' ? {
        location: editLocation,
        powerLevel: editPower,
        status: editStatus,
      } : undefined,
    };

    onUpdateCodexEntry(updated);
    setIsEditing(false);
  };

  const getTabIcon = (tab: TabType) => {
    switch (tab) {
      case 'character': return <Users className="w-4 h-4" />;
      case 'item': return <Swords className="w-4 h-4" />;
      case 'location': return <Compass className="w-4 h-4" />;
      case 'faction': return <Shield className="w-4 h-4" />;
    }
  };

  const tabLabels: { value: TabType; label: string }[] = [
    { value: 'character', label: '人物' },
    { value: 'item', label: '法宝/道具' },
    { value: 'location', label: '场景/地理' },
    { value: 'faction', label: '势力/宗门' },
  ];

  return (
    <div className="flex flex-col h-full bg-stone-50 border-l border-stone-200">
      {/* Header Tabs */}
      <div className="p-3 border-b border-stone-200 bg-stone-50/50">
        <div className="flex gap-1 bg-stone-200/60 p-1 rounded-md">
          {tabLabels.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 px-1 rounded font-medium transition ${
                activeTab === tab.value
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-white/40'
              }`}
            >
              {getTabIcon(tab.value)}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Entries List (Top-Left) + Entry Detail (Rest) */}
      <div className="flex-1 overflow-y-auto flex flex-col divide-y divide-stone-200">
        {/* Entity Cards Selector */}
        <div className="p-3 bg-stone-50/40">
          <div className="flex justify-between items-center mb-2">
            <span className="font-serif font-semibold text-stone-600 text-xs uppercase tracking-wider">设定列表</span>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-900 font-medium font-mono"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              新增档案
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {filteredCodex.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => handleSelectEntry(entry)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition ${
                    isSelected
                      ? 'border-amber-600 bg-amber-50 text-amber-950 shadow-sm'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-600' : 'bg-stone-300'}`} />
                  <span className="font-serif font-medium">{entry.name}</span>
                </button>
              );
            })}
            {filteredCodex.length === 0 && (
              <span className="text-stone-400 italic text-xs py-2">此类别暂无设定卡，点击右上角新增...</span>
            )}
          </div>
        </div>

        {/* Selected Entity Details */}
        {selectedEntry ? (
          <div className="flex-1 p-4 space-y-4 bg-white">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border font-serif font-bold text-sm shadow-inner ${selectedEntry.avatarColor || 'bg-stone-100 text-stone-700 border-stone-300'}`}>
                  {selectedEntry.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-stone-800 text-base">{selectedEntry.name}</h3>
                  <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">{selectedEntry.type}</p>
                </div>
              </div>

              <div className="flex gap-1">
                {isEditing ? (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1 text-[11px] bg-emerald-700 text-emerald-50 hover:bg-emerald-800 px-2.5 py-1.5 rounded font-mono font-medium shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" /> 保存设定
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 text-[11px] border border-stone-200 text-stone-600 hover:bg-stone-50 px-2.5 py-1.5 rounded font-mono"
                    >
                      <Edit className="w-3.5 h-3.5" /> 修改
                    </button>
                    <button
                      onClick={() => onDeleteCodexEntry(selectedEntry.id)}
                      className="p-1.5 rounded border border-stone-200 text-stone-400 hover:text-red-600 hover:bg-stone-50"
                      title="删除卡片"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Editable Details Form */}
            {isEditing ? (
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">实体名称</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2 border border-stone-200 rounded font-serif text-stone-800 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">
                    联想触发词 (Aliases / Keywords)
                  </label>
                  <input
                    type="text"
                    value={editAliases}
                    onChange={(e) => setEditAliases(e.target.value)}
                    placeholder="用英文逗号隔开，如：陆沉, 阿沉, 零号"
                    className="w-full p-2 border border-stone-200 rounded font-mono text-stone-800 focus:outline-none focus:border-amber-600"
                  />
                  <p className="text-[10px] text-stone-400 mt-1">
                    * 写入小说正文时，一旦匹配到这些词汇，将自动触发 L3 记忆联想召回。
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1">设定详情描述</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full p-2 border border-stone-200 rounded font-serif text-stone-800 focus:outline-none focus:border-amber-600 h-28 resize-none leading-relaxed"
                  />
                </div>

                {activeTab === 'character' && (
                  <div className="border-t border-stone-100 pt-3 space-y-3">
                    <h4 className="font-serif font-bold text-stone-700 text-xs flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-amber-700" /> 动态属性卡 (L0 实时状态)
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono font-medium text-stone-400 uppercase mb-0.5">灵能等级/境界</label>
                        <input
                          type="text"
                          value={editPower}
                          onChange={(e) => setEditPower(e.target.value)}
                          placeholder="如：筑基期"
                          className="w-full p-1.5 border border-stone-200 rounded focus:outline-none focus:border-amber-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono font-medium text-stone-400 uppercase mb-0.5">当前物理位置</label>
                        <input
                          type="text"
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          placeholder="如：十三街区"
                          className="w-full p-1.5 border border-stone-200 rounded focus:outline-none focus:border-amber-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-medium text-stone-400 uppercase mb-1">身体状况 / 戒备等级</label>
                      <input
                        type="text"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        placeholder="如：受重伤 / 极度虚弱"
                        className="w-full p-2 border border-stone-200 rounded focus:outline-none focus:border-amber-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-medium text-stone-400 uppercase mb-1">状态总结 (Markdown)</label>
                      <textarea
                        value={editCurrentState}
                        onChange={(e) => setEditCurrentState(e.target.value)}
                        placeholder="对当前状态的细节补充描述..."
                        className="w-full p-2 border border-stone-200 rounded focus:outline-none focus:border-amber-600 h-16 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Read Only Preview Panel
              <div className="space-y-4 text-xs text-stone-700">
                {/* Keywords tag pills */}
                <div>
                  <span className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1 tracking-wider">匹配召回词 (Keywords)</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedEntry.aliases.map((alias, idx) => (
                      <span key={idx} className="font-mono text-[10px] px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full border border-stone-200/50">
                        {alias}
                      </span>
                    ))}
                    {selectedEntry.aliases.length === 0 && (
                      <span className="text-[10px] text-stone-400 italic">暂无触发词，请修改以关联正文</span>
                    )}
                  </div>
                </div>

                {/* Main description */}
                <div>
                  <span className="block text-[10px] font-mono font-semibold text-stone-400 uppercase mb-1 tracking-wider">背景原设档案 (L0 Facts)</span>
                  <p className="font-serif text-[13px] leading-relaxed text-stone-800 bg-stone-50 p-3 rounded-md border border-stone-100 whitespace-pre-wrap">
                    {selectedEntry.description}
                  </p>
                </div>

                {/* Character Dynamic states */}
                {selectedEntry.type === 'character' && (
                  <>
                    <div className="border-t border-stone-100 pt-3 space-y-2.5">
                      <span className="block text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-wider">动态设定属性卡</span>
                      
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-amber-50/20 border border-amber-100/50 p-2 rounded">
                          <span className="block text-[9px] font-mono text-stone-400 uppercase">境界/战力段位</span>
                          <span className="font-serif font-bold text-amber-950 mt-0.5 block">{selectedEntry.dynamicState?.powerLevel || '未设定'}</span>
                        </div>
                        <div className="bg-emerald-50/20 border border-emerald-100/50 p-2 rounded">
                          <span className="block text-[9px] font-mono text-stone-400 uppercase">当前坐标</span>
                          <span className="font-serif font-bold text-emerald-950 mt-0.5 block">{selectedEntry.dynamicState?.location || '未设定'}</span>
                        </div>
                      </div>

                      <div className="bg-stone-50 border border-stone-200/40 p-2.5 rounded">
                        <span className="block text-[9px] font-mono text-stone-400 uppercase">实时身体或警戒状态</span>
                        <span className="font-serif text-stone-800 mt-1 block font-medium">{selectedEntry.dynamicState?.status || '状态良好'}</span>
                      </div>

                      {selectedEntry.currentState && (
                        <div className="bg-stone-50 border border-stone-200/40 p-2.5 rounded">
                          <span className="block text-[9px] font-mono text-stone-400 uppercase">当前详细生存快照</span>
                          <p className="font-serif text-stone-700 mt-1 leading-relaxed whitespace-pre-wrap">{selectedEntry.currentState}</p>
                        </div>
                      )}
                    </div>

                    {/* Timeline dynamic state history logs */}
                    <div className="border-t border-stone-100 pt-3 space-y-2">
                      <span className="block text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-wider">状态变更时间线 (Confirmed Logs)</span>
                      <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                        {stateLogs
                          .filter((log) => log.characterId === selectedEntry.id)
                          .map((log) => (
                            <div key={log.id} className="relative pl-3 border-l-2 border-amber-600/30 text-[11px]">
                              <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-amber-600 border border-white" />
                              <div className="flex justify-between items-center text-stone-400 text-[10px] font-mono mb-0.5">
                                <span>{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                <span className="bg-stone-100 px-1 rounded">Chapter {log.chapterId.replace('chap_', '')}</span>
                              </div>
                              <p className="font-serif text-stone-700 leading-relaxed font-medium">
                                <span className="text-amber-800 font-mono">[{log.key}]</span> 改为: {log.value}
                              </p>
                            </div>
                          ))}
                        {stateLogs.filter((log) => log.characterId === selectedEntry.id).length === 0 && (
                          <span className="text-[10px] text-stone-400 italic block py-1">暂无状态变更记录，章节提炼会自动捕获此履历。</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400 p-8 text-center text-xs">
            <Bookmark className="w-8 h-8 text-stone-300 mb-2" />
            <p>未选中任何设定卡片</p>
          </div>
        )}
      </div>
    </div>
  );
}
