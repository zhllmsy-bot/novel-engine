import type { SkillManifest } from '../types/domain'

export const builtinSkills: SkillManifest[] = [
  {
    id: 'core.chapter_summary_generate',
    name: '章节摘要生成',
    version: '0.1.0',
    category: 'memory',
    description: '生成结构化章节摘要、关键事件和出场人物，写入 L1 派生记忆。',
    riskLevel: 'low',
    outputMode: 'chapter_summary',
    outputSchema: 'chapter_summary',
    requiresReview: false,
    prompt:
      '阅读当前章节正文，生成 200-300 字中文章节摘要。摘要必须覆盖因果推进、关键事件、人物状态变化和伏笔，不要只抽取开头句。输出 keyEvents 和 charactersInvolved。',
    input: {
      required: ['nearby_text'],
      optional: ['character_cards', 'plot_memory', 'recall_audit'],
    },
    retrieval: {
      includeRecentChapters: 0,
      includeCharacters: 'auto',
      includeWorldbuilding: 'auto',
      includeRecall: 'auto',
      sourceFamilies: ['manuscript', 'codex', 'chapter_summary', 'plot_thread', 'recall'],
    },
    model: {
      profile: 'fast',
      temperature: 0.2,
    },
  },
  {
    id: 'xuanhuan.dialogue_polish',
    name: '玄幻对白润色',
    version: '0.1.0',
    category: 'rewrite',
    description: '保持人物身份和境界压迫感，润色选中对白。',
    riskLevel: 'medium',
    outputMode: 'rewrite_patch',
    outputSchema: 'diff_patch',
    requiresReview: true,
  },
  {
    id: 'xuanhuan.foreshadowing_review',
    name: '伏笔回收检查',
    version: '0.1.0',
    category: 'memory',
    description: '检查本章是否埋下或呼应伏笔，只提出可确认的伏笔记忆。',
    riskLevel: 'medium',
    outputMode: 'memory_update_proposal',
    outputSchema: 'plot_thread_proposal',
    requiresReview: true,
  },
  {
    id: 'xuanhuan.state_proposal',
    name: '人物状态提议',
    version: '0.1.0',
    category: 'memory',
    description: '只提出人物状态变更建议，等待作者确认。',
    riskLevel: 'high',
    outputMode: 'memory_update_proposal',
    outputSchema: 'character_state_proposal',
    requiresReview: true,
  },
]

export function getRewriteSkill() {
  return builtinSkills.find((skill) => skill.outputMode === 'rewrite_patch')
}
