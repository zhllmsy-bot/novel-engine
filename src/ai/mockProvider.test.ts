import { describe, expect, it } from 'vitest'
import { validateRewritePatch } from '../diff/safeRewrite'
import type { SkillRunRequest } from '../types/domain'
import { mockProvider } from './mockProvider'

const rewriteRequest: SkillRunRequest = {
  skill: {
    id: 'xuanhuan.dialogue_polish',
    name: '玄幻对白润色',
    version: '0.1.0',
    category: 'rewrite',
    description: '润色当前章节片段。',
    riskLevel: 'medium',
    outputMode: 'rewrite_patch',
    outputSchema: 'diff_patch',
    requiresReview: true,
  },
  context: {
    selectedText: '',
    nearbyText: '# 第001章 山门雨\n\n雨落在玄天宗山门前时，沈微第一次听见玄铁剑的声音。',
    chapterTitle: '第001章 山门雨',
    memories: [],
  },
}

describe('mock provider', () => {
  it('returns a rewrite patch anchored in the current nearby text', async () => {
    const result = await mockProvider.runSkill(rewriteRequest)

    expect(result.type).toBe('rewrite_patch')
    if (result.type === 'rewrite_patch') {
      expect(validateRewritePatch(rewriteRequest.context.nearbyText, result.patch).ok).toBe(
        true,
      )
    }
  })

  it('returns plot-thread proposals for the foreshadowing Skill', async () => {
    const result = await mockProvider.runSkill({
      ...rewriteRequest,
      skill: {
        id: 'xuanhuan.foreshadowing_review',
        name: '伏笔回收检查',
        version: '0.1.0',
        category: 'memory',
        description: '检查本章伏笔。',
        riskLevel: 'medium',
        outputMode: 'memory_update_proposal',
        outputSchema: 'plot_thread_proposal',
        requiresReview: true,
      },
    })

    expect(result.type).toBe('memory_update_proposal')
    if (result.type === 'memory_update_proposal') {
      expect(result.proposals[0]).toMatchObject({
        kind: 'plot_thread',
        title: '玄铁剑裂纹',
        keywords: ['玄铁剑', '裂纹'],
      })
    }
  })
})
