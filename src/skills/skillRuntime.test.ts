import { describe, expect, it } from 'vitest'
import type { ModelProvider } from '../ai/provider'
import type { SkillManifest } from '../types/domain'
import {
  buildSkillContext,
  buildSkillRunAudit,
  filterSkillMemories,
  filterSkillMemoriesWithAudit,
  previewSkillRun,
  resolveSkillInputs,
  runSkillWithProvider,
} from './skillRuntime'
import { parseSkillRunResult } from './skillResultSchema'

const rewriteSkill: SkillManifest = {
  id: 'xuanhuan.dialogue_polish',
  name: '玄幻对白润色',
  version: '0.1.0',
  category: 'rewrite',
  description: '润色选中对白。',
  riskLevel: 'medium',
  outputMode: 'rewrite_patch',
  outputSchema: 'diff_patch',
  requiresReview: true,
  prompt: '保留人物身份，只润色可定位原文。',
  input: {
    required: ['selected_text', 'nearby_text'],
    optional: ['chapter_summary'],
  },
  retrieval: {
    includeRecentChapters: 1,
    includeCharacters: 'auto',
    includeWorldbuilding: 'none',
  },
  model: {
    profile: 'balanced',
    temperature: 0.7,
  },
}

const provider: ModelProvider = {
  id: 'mock.local',
  label: 'Mock Provider',
  async runSkill() {
    return {
      type: 'report',
      title: 'unused',
      body: 'unused',
      auditTrail: [],
    }
  },
}

describe('skill runtime', () => {
  it('builds context with the L1 chapter summary', () => {
    const context = buildSkillContext({
      documentText: '正文',
      selectedText: '正文',
      chapterTitle: '第十二章',
      memories: [
        {
          layer: 'L1 剧情',
          body: '主角进入戒律堂。',
          source: 'chapter_summary:012',
        },
      ],
    })

    expect(context.chapterSummary).toBe('主角进入戒律堂。')
  })

  it('filters memories according to the Skill retrieval policy', () => {
    const skill: SkillManifest = {
      ...rewriteSkill,
      retrieval: {
        includeRecentChapters: 0,
        includeCharacters: 'none',
        includeWorldbuilding: 'none',
        includeRecall: 'none',
      },
    }
    const memories = filterSkillMemories(skill, [
      {
        layer: 'L2 风格',
        body: '近期原文。',
        source: 'manuscript/chapter-011.md',
      },
      {
        layer: 'L0 事实',
        body: '李长老。',
        source: 'codex/characters/li.md',
      },
      {
        layer: 'L0 事实',
        body: '玄天宗。',
        source: 'codex/locations/xuantianzong.md',
      },
      {
        layer: 'L1 剧情',
        body: '前情。',
        source: 'chapter_summary:011',
      },
      {
        layer: 'L3 意图',
        body: '召回审计。',
        source: 'meta/project.json',
      },
      {
        layer: 'L3 意图',
        body: '历史召回。',
        source: 'recall:chapter_summary:001',
      },
    ])

    expect(memories.map((memory) => memory.layer)).toEqual([
      'L1 剧情',
      'L3 意图',
    ])
    expect(memories.map((memory) => memory.source)).toEqual([
      'chapter_summary:011',
      'meta/project.json',
    ])

    const filtered = filterSkillMemoriesWithAudit(skill, [
      {
        layer: 'L2 风格',
        body: '近期原文。',
        source: 'manuscript/chapter-011.md',
      },
      {
        layer: 'L0 事实',
        body: '李长老。',
        source: 'codex/characters/li.md',
      },
      {
        layer: 'L0 事实',
        body: '玄天宗。',
        source: 'codex/locations/xuantianzong.md',
      },
      {
        layer: 'L3 意图',
        body: '历史召回。',
        source: 'recall:chapter_summary:001',
      },
    ])

    expect(filtered.audit).toEqual({
      beforeCount: 4,
      afterCount: 0,
      droppedCount: 4,
      dropped: [
        {
          layer: 'L2 风格',
          source: 'manuscript/chapter-011.md',
          reason: 'recent_chapters_disabled',
        },
        {
          layer: 'L0 事实',
          source: 'codex/characters/li.md',
          reason: 'characters_disabled',
        },
        {
          layer: 'L0 事实',
          source: 'codex/locations/xuantianzong.md',
          reason: 'worldbuilding_disabled',
        },
        {
          layer: 'L3 意图',
          source: 'recall:chapter_summary:001',
          reason: 'recall_disabled',
        },
      ],
    })
  })

  it('builds Skill context with filtered memories when a Skill is provided', () => {
    const context = buildSkillContext({
      documentText: '正文',
      selectedText: '正文',
      chapterTitle: '第十二章',
      skill: {
        ...rewriteSkill,
        retrieval: {
          includeCharacters: 'none',
          includeWorldbuilding: 'auto',
        },
      },
      memories: [
        {
          layer: 'L0 事实',
          body: '李长老。',
          source: 'codex/characters/li.md',
        },
        {
          layer: 'L1 剧情',
          body: '主角进入戒律堂。',
          source: 'chapter_summary:012',
        },
      ],
    })

    expect(context.memories).toHaveLength(1)
    expect(context.memories[0].layer).toBe('L1 剧情')
    expect(context.chapterSummary).toBe('主角进入戒律堂。')
  })

  it('filters memories by declared source families with an inspectable audit', () => {
    const skill: SkillManifest = {
      ...rewriteSkill,
      retrieval: {
        sourceFamilies: ['codex', 'recall'],
      },
    }
    const filtered = filterSkillMemoriesWithAudit(skill, [
      {
        layer: 'L2 风格',
        body: '近期原文。',
        source: 'manuscript/chapter-011.md',
      },
      {
        layer: 'L0 事实',
        body: '李长老。',
        source: 'codex/characters/li.md',
      },
      {
        layer: 'L3 意图',
        body: '历史召回。',
        source: 'recall:chapter_summary:001',
      },
      {
        layer: 'L1 剧情',
        body: '前情。',
        source: 'chapter_summary:011',
      },
    ])

    expect(filtered.memories.map((memory) => memory.source)).toEqual([
      'codex/characters/li.md',
      'recall:chapter_summary:001',
    ])
    expect(filtered.audit).toEqual({
      beforeCount: 4,
      afterCount: 2,
      droppedCount: 2,
      dropped: [
        {
          layer: 'L2 风格',
          source: 'manuscript/chapter-011.md',
          reason: 'source_family_disabled',
        },
        {
          layer: 'L1 剧情',
          source: 'chapter_summary:011',
          reason: 'source_family_disabled',
        },
      ],
    })
  })

  it('keeps multi-source memories when any source family is allowed', () => {
    const skill: SkillManifest = {
      ...rewriteSkill,
      retrieval: {
        sourceFamilies: ['plot_thread'],
      },
    }
    const filtered = filterSkillMemories(skill, [
      {
        layer: 'L1 剧情',
        body: '前情与伏笔。',
        source: 'chapter_summary:011;plot_thread:thread-1',
      },
      {
        layer: 'L3 意图',
        body: '召回审计。',
        source: 'meta/project.json',
      },
    ])

    expect(filtered.map((memory) => memory.source)).toEqual([
      'chapter_summary:011;plot_thread:thread-1',
    ])
  })

  it('builds an inspectable Skill run audit from declared manifest metadata', () => {
    const context = buildSkillContext({
      documentText: '正文正文',
      selectedText: '正文',
      chapterTitle: '第十二章',
      memories: [
        {
          layer: 'L0 事实',
          body: '李长老是金丹期。',
          source: 'codex/characters/li.md',
        },
        {
          layer: 'L1 剧情',
          body: '沈微被带入戒律堂。',
          source: 'chapter_summary:012',
        },
      ],
    })
    const audit = buildSkillRunAudit(rewriteSkill, context, provider)

    expect(audit.skill).toMatchObject({
      id: 'xuanhuan.dialogue_polish',
      outputMode: 'rewrite_patch',
      requiresReview: true,
    })
    expect(audit.provider).toEqual({
      id: 'mock.local',
      label: 'Mock Provider',
    })
    expect(audit.prompt).toContain('保留人物身份')
    expect(audit.input.required).toEqual(['selected_text', 'nearby_text'])
    expect(audit.retrieval.includeCharacters).toBe('auto')
    expect(audit.model.temperature).toBe(0.7)
    expect(audit.input.available).toEqual([
      'selected_text',
      'nearby_text',
      'chapter_summary',
    ])
    expect(audit.input.missingRequired).toEqual([])
    expect(audit.context).toMatchObject({
      chapterTitle: '第十二章',
      selectedChars: 2,
      nearbyChars: 4,
      memoryCount: 2,
    })
    expect(audit.memorySources).toEqual([
      'L0 事实:codex/characters/li.md',
      'L1 剧情:chapter_summary:012',
    ])
    expect(audit.memoryLayerSummaries).toEqual([
      {
        layer: 'L0 事实',
        count: 1,
        chars: '李长老是金丹期。'.length,
        sources: ['codex/characters/li.md'],
      },
      {
        layer: 'L1 剧情',
        count: 1,
        chars: '沈微被带入戒律堂。'.length,
        sources: ['chapter_summary:012'],
      },
    ])
    expect(audit.memoryFilter).toMatchObject({
      beforeCount: 2,
      afterCount: 2,
      droppedCount: 0,
      dropped: [],
    })
  })

  it('previews a Skill run without calling the provider', () => {
    const provider: ModelProvider = {
      id: 'preview.mock',
      label: 'Preview Mock',
      async runSkill() {
        throw new Error('preview should not call provider')
      },
    }
    const preview = previewSkillRun({
      documentText: '附近正文',
      selectedText: '',
      chapterTitle: '第十二章',
      skill: rewriteSkill,
      provider,
      memories: [
        {
          layer: 'L2 风格',
          body: '近期文风。',
          source: 'manuscript/chapter-011.md',
        },
      ],
    })

    expect(preview.canRun).toBe(false)
    expect(preview.audit.input.available).toEqual(['nearby_text'])
    expect(preview.audit.input.missingRequired).toEqual(['selected_text'])
    expect(preview.audit.context).toMatchObject({
      chapterTitle: '第十二章',
      selectedChars: 0,
      nearbyChars: 4,
      memoryCount: 1,
    })
    expect(preview.audit.memorySources).toEqual([
      'L2 风格:manuscript/chapter-011.md',
    ])
    expect(preview.audit.memoryLayerSummaries).toEqual([
      {
        layer: 'L2 风格',
        count: 1,
        chars: '近期文风。'.length,
        sources: ['manuscript/chapter-011.md'],
      },
    ])
    expect(preview.audit.memoryFilter).toMatchObject({
      beforeCount: 1,
      afterCount: 1,
      droppedCount: 0,
    })
  })

  it('resolves available and missing Skill inputs from the runtime context', () => {
    const context = buildSkillContext({
      documentText: '附近正文',
      selectedText: '',
      chapterTitle: '第十二章',
      memories: [
        {
          layer: 'L2 风格',
          body: '近期文风。',
          source: 'manuscript/chapter-011.md',
        },
      ],
    })

    expect(resolveSkillInputs(rewriteSkill, context)).toEqual({
      available: ['nearby_text'],
      missingRequired: ['selected_text'],
    })
  })

  it('only marks character_cards available for character or state memories', () => {
    const skill: SkillManifest = {
      ...rewriteSkill,
      input: {
        required: ['character_cards'],
        optional: [],
      },
    }
    const worldOnlyContext = buildSkillContext({
      documentText: '附近正文',
      selectedText: '',
      chapterTitle: '第十二章',
      memories: [
        {
          layer: 'L0 事实',
          body: '玄天宗。',
          source: 'codex/locations/xuantianzong.md',
        },
      ],
    })
    const characterStateContext = buildSkillContext({
      documentText: '附近正文',
      selectedText: '',
      chapterTitle: '第十二章',
      memories: [
        {
          layer: 'L0 事实',
          body: '李长老动态状态: 修为 = 金丹期。',
          source: 'character_state_log:state-1',
        },
      ],
    })

    expect(resolveSkillInputs(skill, worldOnlyContext)).toEqual({
      available: [],
      missingRequired: ['character_cards'],
    })
    expect(resolveSkillInputs(skill, characterStateContext)).toEqual({
      available: ['character_cards'],
      missingRequired: [],
    })
  })

  it('rejects skill runs when a required input is unavailable', async () => {
    await expect(
      runSkillWithProvider(
        rewriteSkill,
        {
          selectedText: '',
          nearbyText: '附近正文',
          chapterTitle: '第十二章',
          memories: [],
        },
        provider,
      ),
    ).rejects.toThrow('missing required input: selected_text')
  })

  it('rejects provider results that do not match the skill output mode', async () => {
    const provider: ModelProvider = {
      id: 'bad.mock',
      label: 'Bad Mock',
      async runSkill() {
        return {
          type: 'report',
          title: 'Wrong result',
          body: 'This should be rejected.',
          auditTrail: [],
        }
      },
    }

    await expect(
      runSkillWithProvider(
        rewriteSkill,
        {
          selectedText: '正文',
          nearbyText: '正文',
          chapterTitle: '第十二章',
          memories: [],
        },
        provider,
      ),
    ).rejects.toThrow('declared rewrite_patch, but provider returned report')
  })

  it('rejects incomplete rewrite patches at the runtime boundary', async () => {
    const provider: ModelProvider = {
      id: 'bad.patch',
      label: 'Bad Patch',
      async runSkill() {
        return {
          type: 'rewrite_patch',
          patch: {
            original: '正文',
            proposed: '新正文',
            skillId: 'xuanhuan.dialogue_polish',
            requiresSnapshot: false,
          },
          auditTrail: [],
        } as never
      },
    }

    await expect(
      runSkillWithProvider(
        rewriteSkill,
        {
          selectedText: '正文',
          nearbyText: '正文',
          chapterTitle: '第十二章',
          memories: [],
        },
        provider,
      ),
    ).rejects.toThrow()
  })

  it('rejects memory proposals that do not match the declared output schema', async () => {
    const skill: SkillManifest = {
      ...rewriteSkill,
      id: 'xuanhuan.foreshadowing_thread',
      name: '玄幻伏笔入库',
      category: 'memory',
      outputMode: 'memory_update_proposal',
      outputSchema: 'plot_thread_proposal',
      input: {
        required: ['nearby_text'],
        optional: [],
      },
    }
    const provider: ModelProvider = {
      id: 'bad.memory',
      label: 'Bad Memory',
      async runSkill() {
        return {
          type: 'memory_update_proposal',
          title: '人物状态提议',
          body: '这不该出现在伏笔 Skill 里。',
          proposals: [
            {
              kind: 'character_state',
              characterName: '沈微',
              field: '心理状态',
              to: '正面反抗',
              reason: '本章中沈微主动对抗李长老。',
            },
          ],
          auditTrail: [],
        }
      },
    }

    await expect(
      runSkillWithProvider(
        skill,
        {
          selectedText: '',
          nearbyText: '沈微没有退。',
          chapterTitle: '第十二章',
          memories: [],
        },
        provider,
      ),
    ).rejects.toThrow(
      'declared plot_thread_proposal, but provider returned character_state',
    )
  })

  it('allows mixed memory proposals when the Skill declares mixed output', async () => {
    const skill: SkillManifest = {
      ...rewriteSkill,
      id: 'demo.foreshadowing_review',
      name: '本书伏笔体检',
      category: 'memory',
      outputMode: 'memory_update_proposal',
      outputSchema: 'mixed_memory_update',
      input: {
        required: ['nearby_text'],
        optional: [],
      },
    }
    const provider: ModelProvider = {
      id: 'mixed.memory',
      label: 'Mixed Memory',
      async runSkill() {
        return {
          type: 'memory_update_proposal',
          title: '混合记忆提议',
          body: '同时发现状态变化和伏笔。',
          proposals: [
            {
              kind: 'character_state',
              characterName: '沈微',
              field: '心理状态',
              to: '正面反抗',
              reason: '本章中沈微主动对抗李长老。',
            },
            {
              kind: 'plot_thread',
              title: '玄铁剑裂纹',
              content: '玄铁剑裂纹来源尚未揭示。',
              keywords: ['玄铁剑', '裂纹'],
            },
          ],
          auditTrail: [],
        }
      },
    }

    const result = await runSkillWithProvider(
      skill,
      {
        selectedText: '',
        nearbyText: '沈微没有退，玄铁剑裂纹扩大。',
        chapterTitle: '第十二章',
        memories: [],
      },
      provider,
    )

    expect(result.type).toBe('memory_update_proposal')
    if (result.type === 'memory_update_proposal') {
      expect(result.proposals.map((proposal) => proposal.kind)).toEqual([
        'character_state',
        'plot_thread',
      ])
    }
  })

  it('parses plot-thread memory proposals at the safe result boundary', () => {
    const result = parseSkillRunResult({
      type: 'memory_update_proposal',
      title: '伏笔记忆提议',
      body: '检测到一个未回收伏笔。',
      proposals: [
        {
          kind: 'plot_thread',
          title: '玄铁剑裂纹',
          content: '玄铁剑裂纹来源尚未揭示。',
          keywords: ['玄铁剑', '裂纹'],
          relatedCharacters: ['沈微'],
          evidence: '剑身裂纹扩大。',
          confidence: 'medium',
        },
      ],
      auditTrail: ['skill:xuanhuan.foreshadowing_review'],
    })

    expect(result.type).toBe('memory_update_proposal')
    if (result.type === 'memory_update_proposal') {
      expect(result.proposals[0]).toMatchObject({
        kind: 'plot_thread',
        title: '玄铁剑裂纹',
      })
    }
  })

  it('parses character-state memory proposals at the safe result boundary', () => {
    const result = parseSkillRunResult({
      type: 'memory_update_proposal',
      title: '人物状态提议',
      body: '检测到人物状态变化。',
      proposals: [
        {
          kind: 'character_state',
          characterName: '沈微',
          field: '心理状态',
          from: '胆怯',
          to: '正面反抗',
          reason: '本章中沈微主动对抗李长老。',
          evidence: '他没有退。',
          confidence: 'medium',
        },
      ],
      auditTrail: ['skill:xuanhuan.state_proposal'],
    })

    expect(result.type).toBe('memory_update_proposal')
    if (result.type === 'memory_update_proposal') {
      expect(result.proposals[0]).toMatchObject({
        kind: 'character_state',
        characterName: '沈微',
      })
    }
  })

  it('rejects character-state memory proposals without an explicit kind', () => {
    expect(() =>
      parseSkillRunResult({
        type: 'memory_update_proposal',
        title: '人物状态提议',
        body: '检测到人物状态变化。',
        proposals: [
          {
            characterName: '沈微',
            field: '心理状态',
            to: '正面反抗',
            reason: '本章中沈微主动对抗李长老。',
          },
        ],
        auditTrail: ['skill:xuanhuan.state_proposal'],
      }),
    ).toThrow()
  })

  it('rejects extra fields in Skill result payloads', () => {
    expect(() =>
      parseSkillRunResult({
        type: 'memory_update_proposal',
        title: '人物状态提议',
        body: '检测到人物状态变化。',
        proposals: [
          {
            kind: 'character_state',
            characterName: '沈微',
            field: '心理状态',
            to: '正面反抗',
            reason: '本章中沈微主动对抗李长老。',
            applyImmediately: true,
          },
        ],
        auditTrail: ['skill:xuanhuan.state_proposal'],
      }),
    ).toThrow()
  })
})
