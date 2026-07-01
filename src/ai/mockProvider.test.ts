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

  it('returns structured chapter summary results for summary Skills', async () => {
    const result = await mockProvider.runSkill({
      ...rewriteRequest,
      skill: {
        id: 'core.chapter_summary_generate',
        name: '章节摘要生成',
        version: '0.1.0',
        category: 'memory',
        description: '生成结构化章节摘要。',
        riskLevel: 'low',
        outputMode: 'chapter_summary',
        outputSchema: 'chapter_summary',
        requiresReview: false,
      },
      context: {
        ...rewriteRequest.context,
        memories: [
          {
            layer: 'L0 事实',
            body: '李长老是玄天宗长老。',
            source: 'codex/characters/li-zhanglao.md',
          },
        ],
      },
    })

    expect(result.type).toBe('chapter_summary')
    if (result.type === 'chapter_summary') {
      expect(result.summary).toContain('起因:')
      expect(result.summary).toContain('沈微第一次听见玄铁剑的声音')
      expect(result.keyEvents.length).toBeGreaterThan(0)
      expect(result.charactersInvolved).toEqual([
        'codex/characters/li-zhanglao.md',
      ])
      expect(result.auditTrail).toContain('skill:core.chapter_summary_generate')
    }
  })
})
