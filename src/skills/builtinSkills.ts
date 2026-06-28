import type { SkillManifest } from '../types/domain'

export const builtinSkills: SkillManifest[] = [
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
