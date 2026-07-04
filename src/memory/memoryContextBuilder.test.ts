import { describe, expect, it } from 'vitest'
import { loadDemoProject } from '../project/demoProjectRepository'
import {
  buildNarrativeMemories,
  buildNarrativeMemoryPlan,
  getMemoryLayerPriority,
  memoryBudgetLayerOrder,
  memoryBudgetPolicy,
} from './memoryContextBuilder'

describe('narrative memory context builder', () => {
  it('exports the four-layer memory budget policy as a stable runtime contract', () => {
    expect(memoryBudgetLayerOrder).toEqual([
      'L2 风格',
      'L0 事实',
      'L3 意图',
      'L1 剧情',
    ])
    expect(memoryBudgetPolicy.promptOrder).toEqual([
      '用户指令',
      'L2 风格',
      'L0 事实',
      'L3 意图',
      'L1 剧情',
    ])
    expect(memoryBudgetPolicy.recentChapterCount).toBe(3)
    expect(memoryBudgetPolicy.dynamicRecallTopN).toBe(6)
    expect(memoryBudgetPolicy.detailedSummaryRecentCount).toBe(5)
    expect(memoryBudgetPolicy.distantSummaryMaxSignals).toBe(4)
    expect(memoryBudgetPolicy.layers['L2 风格'].targetBudgetShare).toEqual([
      0.4,
      0.5,
    ])
    expect(getMemoryLayerPriority('L0 事实', 999)).toBeLessThan(
      getMemoryLayerPriority('L2 风格'),
    )
    expect(getMemoryLayerPriority('L1 剧情', 999)).toBeLessThan(
      getMemoryLayerPriority('L3 意图'),
    )
  })

  it('builds runtime memories from open project chapters and codex cards', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const memories = buildNarrativeMemories({
      chapter,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      projectTitle: project.title,
      budgetChars: 900,
    })

    expect(memories.map((memory) => memory.layer)).toEqual([
      'L2 风格',
      'L0 事实',
      'L0 事实',
      'L0 事实',
      'L3 意图',
      'L1 剧情',
    ])
    expect(
      memories.find((memory) => memory.source === 'codex/characters/li-zhanglao.md')
        ?.body,
    ).toContain('李长老')
    expect(
      memories.find((memory) => memory.source === 'codex/characters/li-zhanglao.md')
        ?.body,
    ).toContain('当前状态: 修为=金丹期')
    expect(
      memories.find((memory) => memory.source === 'codex/locations/xuantianzong-gate.md')
        ?.body,
    ).toContain('玄天宗山门')
    expect(memories.find((memory) => memory.layer === 'L1 剧情')?.source).toBe(
      'manuscript/volume-001/chapter-001.md',
    )
  })

  it('injects declared scene definition cards and story time into memory context', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      content: '沈微没有直接说出地点名，只听见雨声压过石阶。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    const sceneMemory = memories.find(
      (memory) => memory.source === 'codex/locations/xuantianzong-gate.md',
    )
    const intentMemory = memories.find(
      (memory) => memory.source === 'meta/project.json',
    )

    expect(sceneMemory).toMatchObject({
      layer: 'L0 事实',
    })
    expect(sceneMemory?.body).toContain('玄天宗山门')
    expect(intentMemory?.body).toContain('故事时间: 玄历三百二十一年·春夜')
    expect(intentMemory?.body).toContain('场景设定: scene-xuantianzong-gate')
  })

  it('keeps recent prose first when the memory budget is tight', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const memories = buildNarrativeMemories({
      chapter,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      projectTitle: project.title,
      budgetChars: 60,
    })

    expect(memories[0].layer).toBe('L2 风格')
    expect(memories[0].body).toContain('当前章节原文')
    expect(memories[0].body.length).toBeLessThanOrEqual(60)
  })

  it('keeps minimum coverage for all four layers when the budget can hold useful slices', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const plan = buildNarrativeMemoryPlan({
      chapter,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      projectTitle: project.title,
      budgetChars: 900,
    })

    const nonEmptyLayers = new Set(
      plan.memories.filter((memory) => memory.body.trim()).map((memory) => memory.layer),
    )

    expect(nonEmptyLayers).toEqual(
      new Set(['L2 风格', 'L0 事实', 'L3 意图', 'L1 剧情']),
    )
    expect(
      plan.audit.layerSummaries.every((summary) => summary.selectedChars > 0),
    ).toBe(true)
  })

  it('builds an inspectable memory budget audit', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const plan = buildNarrativeMemoryPlan({
      chapter,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      projectTitle: project.title,
      budgetChars: 60,
    })

    expect(plan.memories[0].layer).toBe('L2 风格')
    expect(plan.audit.budgetChars).toBe(60)
    expect(plan.audit.usedChars).toBeLessThanOrEqual(60)
    expect(plan.audit.entries[0]).toMatchObject({
      layer: 'L2 风格',
      status: 'truncated',
    })
    expect(plan.audit.layerSummaries.map((summary) => summary.layer)).toEqual(
      memoryBudgetLayerOrder,
    )
    expect(plan.audit.layerSummaries[0]).toMatchObject({
      layer: 'L2 风格',
      targetBudgetShare: [0.4, 0.5],
      entryCount: 1,
      truncatedCount: 1,
    })
    expect(
      plan.audit.layerSummaries.some((summary) => summary.droppedCount > 0),
    ).toBe(true)
    expect(plan.audit.droppedCount).toBeGreaterThan(0)
    expect(
      plan.audit.entries.some((entry) => entry.status === 'dropped'),
    ).toBe(true)
  })

  it('uses generated chapter summaries for the L1 plot memory when available', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const memories = buildNarrativeMemories({
      chapter,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: [
        {
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          summary: '沈微在山门前听见玄铁剑的异常回响，并被李长老追问师父下落。',
          keyEvents: [],
          charactersInvolved: [],
          sourceHash: 'hash',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 900,
    })

    const plotMemory = memories.find((memory) => memory.layer === 'L1 剧情')

    expect(plotMemory).toMatchObject({
      source: `chapter_summary:${chapter.id}`,
    })
    expect(plotMemory?.body).toContain('师父下落')
  })

  it('uses recent previous chapters as L2 style context', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-003',
      title: '第003章 剑阁夜谈',
      path: 'manuscript/volume-001/chapter-003.md',
      order: 3,
      content: '沈微站在剑阁前，听见玄铁剑再次低鸣。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [
        project.chapters[0],
        {
          ...project.chapters[0],
          id: 'chapter-002',
          title: '第002章 石阶问心',
          path: 'manuscript/volume-001/chapter-002.md',
          order: 2,
          content: [
            '李长老让沈微在石阶上等到天明。',
            '雨水顺着石阶往下流。',
            '戒律堂的钟声响过三次。',
            '沈微终于意识到玄铁剑不是在求救，而是在提醒他别回头。',
          ].join('\n\n'),
        },
        chapter,
      ],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    const styleMemory = memories.find((memory) => memory.layer === 'L2 风格')

    expect(styleMemory?.body).toContain('近期前文')
    expect(styleMemory?.body).toContain('李长老让沈微在石阶上等到天明。')
    expect(styleMemory?.body).toContain('玄铁剑不是在求救')
    expect(styleMemory?.body).toContain('第002章 石阶问心')
    expect(styleMemory?.source).toContain(
      'manuscript/volume-001/chapter-002.md',
    )
  })

  it('builds an ordered L1 plot thread from previous chapter summaries', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-003',
      title: '第003章 剑阁夜谈',
      path: 'manuscript/volume-001/chapter-003.md',
      order: 3,
      content: '沈微在剑阁问起师父旧事。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [
        project.chapters[0],
        {
          ...project.chapters[0],
          id: 'chapter-002',
          title: '第002章 石阶问心',
          path: 'manuscript/volume-001/chapter-002.md',
          order: 2,
          content: '沈微被李长老带入戒律堂。',
        },
        chapter,
      ],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: [
        {
          chapterId: 'chapter-002',
          chapterTitle: '第002章 石阶问心',
          summary: '沈微被李长老带入戒律堂。',
          keyEvents: [],
          charactersInvolved: [],
          sourceHash: 'hash-2',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
        {
          chapterId: project.chapters[0].id,
          chapterTitle: project.chapters[0].title,
          summary: '沈微第一次听见玄铁剑，并被问起师父。',
          keyEvents: [],
          charactersInvolved: [],
          sourceHash: 'hash-1',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    const plotMemory = memories.find((memory) => memory.layer === 'L1 剧情')
    const plotBody = plotMemory?.body || ''

    expect(plotBody).toContain('全书脉络')
    expect(plotBody.indexOf('第001章')).toBeLessThan(
      plotBody.indexOf('第002章'),
    )
    expect(plotMemory?.source).toBe(
      `chapter_summary:${project.chapters[0].id},chapter-002`,
    )
  })

  it('does not include unknown-order future chapter summaries in L1 memory', () => {
    const project = loadDemoProject()
    const chapterOne = project.chapters[0]
    const chapterTwo = {
      ...chapterOne,
      id: 'chapter-002',
      title: '第002章 石阶问心',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
      content: '沈微再次握住玄铁剑。',
    }
    const memories = buildNarrativeMemories({
      chapter: chapterTwo,
      projectChapters: [chapterOne, chapterTwo],
      documentText: chapterTwo.content,
      codexEntries: project.codexEntries,
      chapterSummaries: [
        {
          chapterId: chapterOne.id,
          chapterTitle: chapterOne.title,
          summary: '沈微第一次听见玄铁剑。',
          keyEvents: [],
          charactersInvolved: [],
          sourceHash: 'hash-1',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
        {
          chapterId: chapterTwo.id,
          chapterTitle: chapterTwo.title,
          summary: '当前章摘要可以参与上下文。',
          keyEvents: [],
          charactersInvolved: [],
          sourceHash: 'hash-2',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
        {
          chapterId: 'chapter-009',
          chapterTitle: '第009章 旧封印',
          summary: '未来答案: 玄铁剑裂纹来自旧封印松动。',
          keyEvents: ['旧封印松动'],
          charactersInvolved: [],
          sourceHash: 'future-hash',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_600,
    })
    const combinedMemory = memories.map((memory) => memory.body).join('\n')
    const plotMemory = memories.find((memory) => memory.layer === 'L1 剧情')

    expect(combinedMemory).toContain('当前章摘要可以参与上下文')
    expect(combinedMemory).not.toContain('未来答案')
    expect(combinedMemory).not.toContain('旧封印松动')
    expect(plotMemory?.source).toContain(`chapter_summary:${chapterOne.id},chapter-002`)
    expect(plotMemory?.source).not.toContain('chapter-009')
  })

  it('keeps recent L1 summaries detailed and compresses distant summaries by volume', () => {
    const project = loadDemoProject()
    const chapters = Array.from({ length: 8 }, (_, index) => ({
      ...project.chapters[0],
      id: `chapter-${String(index + 1).padStart(3, '0')}`,
      title: `第${String(index + 1).padStart(3, '0')}章 记忆${index + 1}`,
      path: `manuscript/volume-001/chapter-${String(index + 1).padStart(3, '0')}.md`,
      order: index + 1,
      content: `第${index + 1}章正文。`,
    }))
    const currentChapter = chapters[7]
    const summaries = chapters.slice(0, 7).map((chapter, index) => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      summary: `第${index + 1}章完整摘要。远期完整细节-${index + 1} 应该在压缩时让位给关键事件。`,
      keyEvents: [`关键事件-${index + 1}`],
      charactersInvolved: [],
      sourceHash: chapter.id,
      isEdited: false,
      updatedAt: '2026-06-25T00:00:00.000Z',
    }))
    const memories = buildNarrativeMemories({
      chapter: currentChapter,
      projectChapters: chapters,
      documentText: currentChapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: summaries,
      projectTitle: project.title,
      budgetChars: 2_400,
    })
    const plotMemory = memories.find((memory) => memory.layer === 'L1 剧情')
    const plotBody = plotMemory?.body || ''

    expect(memoryBudgetPolicy.detailedSummaryRecentCount).toBe(5)
    expect(plotBody).toContain('近期详细')
    expect(plotBody).toContain('远期压缩')
    expect(plotBody.indexOf('远期压缩')).toBeLessThan(
      plotBody.indexOf('近期详细'),
    )
    expect(plotBody).toContain('第003章 记忆3: 第3章完整摘要')
    expect(plotBody).toContain('第007章 记忆7: 第7章完整摘要')
    expect(plotBody).toContain('第001章 记忆1~第002章 记忆2')
    expect(plotBody).toContain('关键事件-1')
    expect(plotBody).toContain('关键事件-2')
    expect(plotBody).not.toContain('远期完整细节-1')
    expect(plotBody).not.toContain('远期完整细节-2')
  })

  it('uses confirmed volume summaries for distant L1 context when they cover the distant chapters', () => {
    const project = loadDemoProject()
    const chapters = Array.from({ length: 8 }, (_, index) => ({
      ...project.chapters[0],
      id: `chapter-${String(index + 1).padStart(3, '0')}`,
      title: `第${String(index + 1).padStart(3, '0')}章 记忆${index + 1}`,
      path: `manuscript/volume-001/chapter-${String(index + 1).padStart(3, '0')}.md`,
      order: index + 1,
      content: `第${index + 1}章正文。`,
    }))
    const currentChapter = chapters[7]
    const summaries = chapters.slice(0, 7).map((chapter, index) => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      summary: `第${index + 1}章完整摘要。`,
      keyEvents: [`关键事件-${index + 1}`],
      charactersInvolved: [],
      sourceHash: chapter.id,
      isEdited: false,
      updatedAt: '2026-06-25T00:00:00.000Z',
    }))
    const memories = buildNarrativeMemories({
      chapter: currentChapter,
      projectChapters: chapters,
      documentText: currentChapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: summaries,
      volumeSummaries: [
        {
          volumeId: 'volume-001',
          volumeTitle: '第一卷 山门旧账',
          summary: '沈微入玄天宗后，玄铁剑与师父旧账成为第一卷主线。',
          keySignals: ['玄铁剑', '师父旧账'],
          chapterIds: ['chapter-001', 'chapter-002'],
          sourceHash: 'volume-hash',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 2_400,
    })
    const plotMemory = memories.find((memory) => memory.layer === 'L1 剧情')
    const plotBody = plotMemory?.body || ''

    expect(plotMemory?.source).toContain('volume_summary:volume-001')
    expect(plotBody).toContain('第一卷 山门旧账')
    expect(plotBody).toContain('沈微入玄天宗后')
    expect(plotBody).not.toContain('第001章 记忆1~第002章 记忆2')
  })

  it('does not use volume summaries that include future chapters', () => {
    const project = loadDemoProject()
    const chapters = Array.from({ length: 9 }, (_, index) => ({
      ...project.chapters[0],
      id: `chapter-${String(index + 1).padStart(3, '0')}`,
      title: `第${String(index + 1).padStart(3, '0')}章 记忆${index + 1}`,
      path: `manuscript/volume-001/chapter-${String(index + 1).padStart(3, '0')}.md`,
      order: index + 1,
      content: `第${index + 1}章正文。`,
    }))
    const currentChapter = chapters[7]
    const summaries = chapters.slice(0, 7).map((chapter, index) => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      summary: `第${index + 1}章完整摘要。`,
      keyEvents: [`关键事件-${index + 1}`],
      charactersInvolved: [],
      sourceHash: chapter.id,
      isEdited: false,
      updatedAt: '2026-06-25T00:00:00.000Z',
    }))
    const memories = buildNarrativeMemories({
      chapter: currentChapter,
      projectChapters: chapters,
      documentText: currentChapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: summaries,
      volumeSummaries: [
        {
          volumeId: 'volume-001',
          volumeTitle: '第一卷 山门旧账',
          summary: '这里包含第九章才揭示的未来答案。',
          keySignals: ['未来答案'],
          chapterIds: ['chapter-001', 'chapter-002', 'chapter-009'],
          sourceHash: 'future-volume-hash',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 2_400,
    })
    const plotMemory = memories.find((memory) => memory.layer === 'L1 剧情')
    const plotBody = plotMemory?.body || ''

    expect(plotMemory?.source).not.toContain('volume_summary:volume-001')
    expect(plotBody).not.toContain('未来答案')
    expect(plotBody).toContain('第001章 记忆1~第002章 记忆2')
  })

  it('does not use volume summaries with unknown chapter coverage', () => {
    const project = loadDemoProject()
    const chapters = Array.from({ length: 8 }, (_, index) => ({
      ...project.chapters[0],
      id: `chapter-${String(index + 1).padStart(3, '0')}`,
      title: `第${String(index + 1).padStart(3, '0')}章 记忆${index + 1}`,
      path: `manuscript/volume-001/chapter-${String(index + 1).padStart(3, '0')}.md`,
      order: index + 1,
      content: `第${index + 1}章正文。`,
    }))
    const currentChapter = chapters[7]
    const summaries = chapters.slice(0, 7).map((chapter, index) => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      summary: `第${index + 1}章完整摘要。`,
      keyEvents: [`关键事件-${index + 1}`],
      charactersInvolved: [],
      sourceHash: chapter.id,
      isEdited: false,
      updatedAt: '2026-06-25T00:00:00.000Z',
    }))
    const memories = buildNarrativeMemories({
      chapter: currentChapter,
      projectChapters: chapters,
      documentText: currentChapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: summaries,
      volumeSummaries: [
        {
          volumeId: 'volume-001',
          volumeTitle: '第一卷 山门旧账',
          summary: '这里包含未知章节才揭示的隐藏答案。',
          keySignals: ['隐藏答案'],
          chapterIds: ['chapter-001', 'chapter-002', 'chapter-unknown'],
          sourceHash: 'unknown-volume-hash',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 2_400,
    })
    const plotMemory = memories.find((memory) => memory.layer === 'L1 剧情')
    const plotBody = plotMemory?.body || ''

    expect(plotMemory?.source).not.toContain('volume_summary:volume-001')
    expect(plotBody).not.toContain('隐藏答案')
    expect(plotBody).toContain('第001章 记忆1~第002章 记忆2')
  })

  it('exposes keyword hits in the L3 intent memory for recall auditing', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const memories = buildNarrativeMemories({
      chapter,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      projectTitle: project.title,
      budgetChars: 900,
    })

    const intentMemory = memories.find((memory) => memory.layer === 'L3 意图')

    expect(intentMemory?.body).toContain('当前命中关键词')
    expect(intentMemory?.body).toContain('命中设定: 李长老')
  })

  it('includes confirmed character state logs as L0 dynamic facts', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const memories = buildNarrativeMemories({
      chapter,
      documentText: `${chapter.content}\n\n沈微没有退。`,
      codexEntries: project.codexEntries,
      characterStateLogs: [
        {
          kind: 'character_state',
          id: 'state-1',
          characterName: '沈微',
          field: '心理状态',
          from: '胆怯',
          to: '正面反抗',
          reason: '他没有退让。',
          evidence: '沈微没有退。',
          confidence: 'medium',
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sourceSkillId: 'xuanhuan.state_proposal',
          confirmedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    const stateMemory = memories.find((memory) =>
      memory.source.startsWith('character_state_log:'),
    )

    expect(stateMemory).toMatchObject({
      layer: 'L0 事实',
      source: 'character_state_log:state-1',
    })
    expect(stateMemory?.body).toContain('沈微 动态状态')
    expect(stateMemory?.body).toContain('正面反抗')
  })

  it('does not leak future character state logs into earlier chapters', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const futureChapter = {
      ...chapter,
      id: 'chapter-002',
      title: '第002章 石阶问心',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
    }
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [chapter, futureChapter],
      documentText: `${chapter.content}\n\n沈微站在山门前。`,
      codexEntries: project.codexEntries,
      characterStateLogs: [
        {
          kind: 'character_state',
          id: 'future-state',
          characterName: '沈微',
          field: '心理状态',
          from: '胆怯',
          to: '正面反抗',
          reason: '第二章才发生的转变。',
          chapterId: futureChapter.id,
          chapterTitle: futureChapter.title,
          sourceSkillId: 'xuanhuan.state_proposal',
          confirmedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    expect(
      memories.some((memory) => memory.source.includes('future-state')),
    ).toBe(false)
  })

  it('only keeps current-chapter state logs when the active chapter order is not comparable', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      order: Number.NaN,
    }
    const memories = buildNarrativeMemories({
      chapter,
      documentText: `${chapter.content}\n\n沈微没有退。`,
      codexEntries: project.codexEntries,
      characterStateLogs: [
        {
          kind: 'character_state',
          id: 'current-state',
          characterName: '沈微',
          field: '心理状态',
          from: '胆怯',
          to: '正面反抗',
          reason: '当前章发生的转变。',
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sourceSkillId: 'xuanhuan.state_proposal',
          confirmedAt: '2026-06-25T00:00:00.000Z',
        },
        {
          kind: 'character_state',
          id: 'other-state',
          characterName: '沈微',
          field: '心理状态',
          from: '正面反抗',
          to: '识破未来陷阱',
          reason: '未知顺序章节里的未来状态。',
          chapterId: 'chapter-unknown',
          chapterTitle: '未知章节',
          sourceSkillId: 'xuanhuan.state_proposal',
          confirmedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_200,
    })
    const combinedMemory = memories.map((memory) => memory.body).join('\n')

    expect(combinedMemory).toContain('正面反抗')
    expect(combinedMemory).not.toContain('识破未来陷阱')
    expect(
      memories.some((memory) => memory.source.includes('other-state')),
    ).toBe(false)
  })

  it('keeps the latest confirmed state for the same character field at the current chapter', () => {
    const project = loadDemoProject()
    const chapterOne = project.chapters[0]
    const chapterTwo = {
      ...chapterOne,
      id: 'chapter-002',
      title: '第002章 石阶问心',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
    }
    const chapterThree = {
      ...chapterOne,
      id: 'chapter-003',
      title: '第003章 剑阁夜谈',
      path: 'manuscript/volume-001/chapter-003.md',
      order: 3,
    }
    const memories = buildNarrativeMemories({
      chapter: chapterThree,
      projectChapters: [chapterOne, chapterTwo, chapterThree],
      documentText: '沈微在剑阁前整理心绪。',
      codexEntries: project.codexEntries,
      characterStateLogs: [
        {
          kind: 'character_state',
          id: 'state-1',
          characterName: '沈微',
          field: '心理状态',
          from: '胆怯',
          to: '正面反抗',
          reason: '第二章开始反抗。',
          chapterId: chapterTwo.id,
          chapterTitle: chapterTwo.title,
          sourceSkillId: 'xuanhuan.state_proposal',
          confirmedAt: '2026-06-25T00:00:00.000Z',
        },
        {
          kind: 'character_state',
          id: 'state-2',
          characterName: '沈微',
          field: '心理状态',
          from: '正面反抗',
          to: '冷静试探',
          reason: '第三章转为观察剑阁局势。',
          chapterId: chapterThree.id,
          chapterTitle: chapterThree.title,
          sourceSkillId: 'xuanhuan.state_proposal',
          confirmedAt: '2026-06-25T00:10:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    const stateMemories = memories.filter((memory) =>
      memory.source.startsWith('character_state_log:'),
    )

    expect(stateMemories).toHaveLength(1)
    expect(stateMemories[0].source).toBe('character_state_log:state-2')
    expect(stateMemories[0].body).toContain('冷静试探')
    expect(stateMemories[0].body).not.toContain('第二章开始反抗')
  })

  it('shows matched chapter summaries in the L3 recall audit', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-002',
      title: '第002章 石阶问心',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
      content: '沈微再次听见玄铁剑低鸣，想起李长老追问师父下落。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [project.chapters[0], chapter],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: [
        {
          chapterId: project.chapters[0].id,
          chapterTitle: project.chapters[0].title,
          summary: '沈微第一次听见玄铁剑，并被李长老问起师父。',
          keyEvents: [],
          charactersInvolved: [],
          sourceHash: 'hash-1',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    const intentMemory = memories.find((memory) => memory.source === 'meta/project.json')
    const recallMemory = memories.find(
      (memory) => memory.source === 'recall:chapter_summary:chapter-001',
    )

    expect(intentMemory?.body).toContain('命中摘要: 第001章 山门雨')
    expect(intentMemory?.body).toContain('玄铁剑')
    expect(recallMemory).toMatchObject({
      layer: 'L3 意图',
      source: 'recall:chapter_summary:chapter-001',
    })
    expect(recallMemory?.body).toContain(
      '关联召回: 沈微第一次听见玄铁剑',
    )
    expect(recallMemory?.body).toContain('来源: 第001章 山门雨')
    expect(recallMemory?.body).toContain('命中关键词: 李长老、玄铁剑')
  })

  it('keeps a concrete L3 recall slice visible when long prose consumes the remaining budget', () => {
    const project = loadDemoProject()
    const previousChapter = {
      ...project.chapters[0],
      id: 'chapter-001',
      title: '第001章 山门雨',
      path: 'manuscript/volume-001/chapter-001.md',
      order: 1,
      content: '沈微第一次听见玄铁剑，并被李长老问起师父。',
    }
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-002',
      title: '第002章 长卷续写',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
      content: [
        '# 第002章 长卷续写',
        '沈微再次听见玄铁剑低鸣，想起李长老追问师父下落。',
        '他在石阶前反复复盘旧线索。'.repeat(260),
      ].join('\n\n'),
    }
    const plan = buildNarrativeMemoryPlan({
      chapter,
      projectChapters: [previousChapter, chapter],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: [
        {
          chapterId: previousChapter.id,
          chapterTitle: previousChapter.title,
          summary: '沈微第一次听见玄铁剑，并被李长老问起师父。',
          keyEvents: [],
          charactersInvolved: [],
          sourceHash: 'hash-1',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 2_400,
    })
    const intentEntry = plan.audit.entries.find(
      (entry) => entry.source === 'meta/project.json',
    )
    const recallEntry = plan.audit.entries.find(
      (entry) => entry.source === 'recall:chapter_summary:chapter-001',
    )

    expect(intentEntry?.selectedChars).toBeGreaterThan(0)
    expect(recallEntry?.selectedChars).toBeGreaterThanOrEqual(
      memoryBudgetPolicy.minimumUsefulLayerBudgetChars,
    )
    expect(
      plan.memories.find(
        (memory) => memory.source === 'recall:chapter_summary:chapter-001',
      )?.body,
    ).toContain('关联召回: 沈微第一次')
  })

  it('prioritizes concrete rule summaries over nearer generic summary recalls', () => {
    const chapter = {
      id: 'chapter-012',
      title: '第012章 残光临门',
      status: '编辑中' as const,
      path: 'manuscript/chapter-012.md',
      order: 12,
      content: '倒置罗盘压在真北铁上，阿照想起石旁小字。',
      wordCount: 0,
    }
    const projectChapters = [
      {
        ...chapter,
        id: 'chapter-005',
        title: '第005章 墓心小字',
        path: 'manuscript/chapter-005.md',
        order: 5,
      },
      {
        ...chapter,
        id: 'chapter-008',
        title: '第008章 铁墙试针',
        path: 'manuscript/chapter-008.md',
        order: 8,
      },
      chapter,
    ]
    const plan = buildNarrativeMemoryPlan({
      chapter,
      projectChapters,
      documentText: chapter.content,
      codexEntries: [
        {
          id: 'item-inverted-compass',
          name: '倒置罗盘',
          type: 'item',
          path: 'codex/items/inverted-compass.md',
          keywords: ['倒置罗盘', '真北铁', '石旁小字'],
          body: '倒置罗盘的具体用法藏在正文规则里。',
          frontmatter: {},
          currentState: {},
        },
      ],
      chapterSummaries: [
        {
          chapterId: 'chapter-005',
          chapterTitle: '第005章 墓心小字',
          summary: '规则: 针尾指的才是生门；会把针背向真正的缺口；只有反握罗盘。倒置罗盘遇见真北铁时必须按石旁小字行动。',
          keyEvents: ['针尾指的才是生门；会把针背向真正的缺口；只有反握罗盘。'],
          charactersInvolved: [],
          sourceHash: 'rule',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
        {
          chapterId: 'chapter-008',
          chapterTitle: '第008章 铁墙试针',
          summary: '倒置罗盘和真北铁再次出现，阿照看见石旁小字的影子，不要被最亮裂缝牵着走。',
          keyEvents: ['不要被最亮裂缝牵着走。'],
          charactersInvolved: [],
          sourceHash: 'generic',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: '回环墓',
      budgetChars: 900,
    })
    const ruleRecallEntry = plan.audit.entries.find(
      (entry) => entry.source === 'recall:chapter_summary:chapter-005',
    )
    const genericRecallEntry = plan.audit.entries.find(
      (entry) => entry.source === 'recall:chapter_summary:chapter-008',
    )

    expect(ruleRecallEntry?.priority).toBeGreaterThan(
      genericRecallEntry?.priority || 0,
    )
    expect(
      plan.memories.some(
        (memory) => memory.source === 'recall:chapter_summary:chapter-005',
      ),
    ).toBe(true)
  })

  it('includes indexed desktop search results as concrete L3 recall memory', () => {
    const project = loadDemoProject()
    const previousChapter = {
      ...project.chapters[0],
      id: 'chapter-001',
      title: '第001章 青灯誓',
      path: 'manuscript/volume-001/chapter-001.md',
      order: 1,
      content: '简璃在镜湖留下青灯誓。',
    }
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-003',
      title: '第003章 镜湖回声',
      path: 'manuscript/volume-001/chapter-003.md',
      order: 3,
      content: '沈微再次提起镜湖钥。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [previousChapter, chapter],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      indexedRecallResults: [
        {
          chapterId: previousChapter.id,
          chapterTitle: previousChapter.title,
          sourcePath: previousChapter.path,
          snippet: '简璃在镜湖留下青灯誓。',
          score: 0.9,
          source: 'summary',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    const intentMemory = memories.find((memory) => memory.source === 'meta/project.json')
    const recallMemory = memories.find(
      (memory) => memory.source === 'recall:index:chapter-001',
    )

    expect(intentMemory?.body).toContain('命中索引: 第001章 青灯誓(摘要索引)')
    expect(recallMemory).toMatchObject({
      layer: 'L3 意图',
      source: 'recall:index:chapter-001',
    })
    expect(recallMemory?.body).toContain('索引召回: 第001章 青灯誓')
    expect(recallMemory?.body).toContain('简璃在镜湖留下青灯誓')
  })

  it('does not leak current or future indexed search results into L3 recall', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-002',
      title: '第002章 镜湖回声',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
      content: '沈微再次提起镜湖钥。',
    }
    const futureChapter = {
      ...project.chapters[0],
      id: 'chapter-004',
      title: '第004章 未来答案',
      path: 'manuscript/volume-001/chapter-004.md',
      order: 4,
      content: '未来才揭示镜湖钥。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [chapter, futureChapter],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      indexedRecallResults: [
        {
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sourcePath: chapter.path,
          snippet: '当前章节不应作为远程召回。',
          score: 0.9,
          source: 'content',
        },
        {
          chapterId: futureChapter.id,
          chapterTitle: futureChapter.title,
          sourcePath: futureChapter.path,
          snippet: '未来章节不应泄漏。',
          score: 0.9,
          source: 'summary',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_200,
    })

    expect(
      memories.some((memory) => memory.source.startsWith('recall:index:')),
    ).toBe(false)
    expect(memories.map((memory) => memory.body).join('\n')).not.toContain(
      '未来章节不应泄漏',
    )
  })

  it('includes open plot threads in L1 plot memory', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-002',
      title: '第002章 石阶问心',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
      content: '沈微再次握住玄铁剑。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [project.chapters[0], chapter],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: [
        {
          chapterId: project.chapters[0].id,
          chapterTitle: project.chapters[0].title,
          summary: '沈微第一次听见玄铁剑。',
          keyEvents: [],
          charactersInvolved: [],
          sourceHash: 'hash-1',
          isEdited: false,
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      plotThreads: [
        {
          id: 'thread-1',
          title: '玄铁剑裂纹',
          content: '玄铁剑第一次低鸣时出现裂纹，来源尚未揭示。',
          plantedChapterId: project.chapters[0].id,
          plantedChapterTitle: project.chapters[0].title,
          keywords: ['玄铁剑', '裂纹'],
          status: 'open',
          confirmed: true,
          sourceSkillId: 'xuanhuan.foreshadowing_review',
          confirmedAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_600,
    })

    const plotMemory = memories.find((memory) => memory.layer === 'L1 剧情')

    expect(plotMemory?.source).toContain('plot_thread:thread-1')
    expect(plotMemory?.body).toContain('未回收伏笔')
    expect(plotMemory?.body).toContain('玄铁剑裂纹')
  })

  it('recalls matching plot threads as concrete L3 recall entries', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-002',
      title: '第002章 石阶问心',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
      content: '沈微看见玄铁剑裂纹扩大，李长老却让他噤声。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [project.chapters[0], chapter],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      plotThreads: [
        {
          id: 'thread-1',
          title: '玄铁剑裂纹',
          content: '玄铁剑第一次低鸣时出现裂纹，来源尚未揭示。',
          plantedChapterId: project.chapters[0].id,
          plantedChapterTitle: project.chapters[0].title,
          keywords: ['玄铁剑', '裂纹'],
          relatedCharacters: ['李长老'],
          status: 'open',
          confirmed: true,
          sourceSkillId: 'xuanhuan.foreshadowing_review',
          confirmedAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_600,
    })
    const intentMemory = memories.find((memory) => memory.source === 'meta/project.json')
    const plotRecall = memories.find(
      (memory) => memory.source === 'recall:plot_thread:thread-1',
    )

    expect(intentMemory?.body).toContain('命中伏笔: 玄铁剑裂纹')
    expect(plotRecall).toMatchObject({
      layer: 'L3 意图',
      source: 'recall:plot_thread:thread-1',
    })
    expect(plotRecall?.body).toContain('伏笔召回: 玄铁剑裂纹')
    expect(plotRecall?.body).toContain('状态: 未回收')
    expect(plotRecall?.body).toContain('玄铁剑')
    expect(plotRecall?.body).toContain('裂纹')
    expect(plotRecall?.body).toContain('李长老')
  })

  it('does not leak future plot-thread resolutions into earlier chapters', () => {
    const project = loadDemoProject()
    const chapterOne = project.chapters[0]
    const chapterTwo = {
      ...chapterOne,
      id: 'chapter-002',
      title: '第002章 石阶问心',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
      content: '沈微看见玄铁剑裂纹。',
    }
    const chapterFive = {
      ...chapterOne,
      id: 'chapter-005',
      title: '第005章 旧封印',
      path: 'manuscript/volume-001/chapter-005.md',
      order: 5,
      content: '旧封印终于松动。',
    }
    const memories = buildNarrativeMemories({
      chapter: chapterTwo,
      projectChapters: [chapterOne, chapterTwo, chapterFive],
      documentText: chapterTwo.content,
      codexEntries: project.codexEntries,
      plotThreads: [
        {
          id: 'thread-1',
          title: '玄铁剑裂纹',
          content: '玄铁剑第一次低鸣时出现裂纹，来源尚未揭示。',
          plantedChapterId: chapterOne.id,
          plantedChapterTitle: chapterOne.title,
          keywords: ['玄铁剑', '裂纹'],
          status: 'resolved',
          resolvedChapterId: chapterFive.id,
          resolvedChapterTitle: chapterFive.title,
          resolution: '裂纹来自剑中旧封印松动。',
          confirmed: true,
          sourceSkillId: 'xuanhuan.foreshadowing_review',
          confirmedAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_600,
    })
    const combinedMemory = memories.map((memory) => memory.body).join('\n')

    expect(combinedMemory).toContain('玄铁剑裂纹')
    expect(combinedMemory).toContain('状态: 未回收')
    expect(combinedMemory).not.toContain('旧封印松动')
  })

  it('does not leak unknown-order plot-thread resolutions into earlier chapters', () => {
    const project = loadDemoProject()
    const chapterOne = project.chapters[0]
    const chapterTwo = {
      ...chapterOne,
      id: 'chapter-002',
      title: '第002章 石阶问心',
      path: 'manuscript/volume-001/chapter-002.md',
      order: 2,
      content: '沈微看见玄铁剑裂纹。',
    }
    const memories = buildNarrativeMemories({
      chapter: chapterTwo,
      projectChapters: [chapterOne, chapterTwo],
      documentText: chapterTwo.content,
      codexEntries: project.codexEntries,
      plotThreads: [
        {
          id: 'thread-1',
          title: '玄铁剑裂纹',
          content: '玄铁剑第一次低鸣时出现裂纹，来源尚未揭示。',
          plantedChapterId: chapterOne.id,
          plantedChapterTitle: chapterOne.title,
          keywords: ['玄铁剑', '裂纹'],
          status: 'resolved',
          resolvedChapterId: 'chapter-unknown',
          resolvedChapterTitle: '未知章节',
          resolution: '裂纹来自未知章节才揭示的旧封印松动。',
          confirmed: true,
          sourceSkillId: 'xuanhuan.foreshadowing_review',
          confirmedAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_600,
    })
    const combinedMemory = memories.map((memory) => memory.body).join('\n')

    expect(combinedMemory).toContain('玄铁剑裂纹')
    expect(combinedMemory).toContain('状态: 未回收')
    expect(combinedMemory).not.toContain('未知章节才揭示')
    expect(combinedMemory).not.toContain('旧封印松动')
  })

  it('only keeps current-chapter plot threads when the active chapter order is not comparable', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      order: Number.NaN,
      content: '沈微看见玄铁剑裂纹。',
    }
    const memories = buildNarrativeMemories({
      chapter,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      plotThreads: [
        {
          id: 'current-thread',
          title: '玄铁剑裂纹',
          content: '当前章发现玄铁剑裂纹。',
          plantedChapterId: chapter.id,
          plantedChapterTitle: chapter.title,
          keywords: ['玄铁剑', '裂纹'],
          status: 'open',
          confirmed: true,
          sourceSkillId: 'xuanhuan.foreshadowing_review',
          confirmedAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
        {
          id: 'other-thread',
          title: '未知章节答案',
          content: '未知顺序章节里才出现的答案。',
          plantedChapterId: 'chapter-unknown',
          plantedChapterTitle: '未知章节',
          keywords: ['玄铁剑'],
          status: 'resolved',
          resolution: '未来答案不应进入当前上下文。',
          confirmed: true,
          sourceSkillId: 'xuanhuan.foreshadowing_review',
          confirmedAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      projectTitle: project.title,
      budgetChars: 1_600,
    })
    const combinedMemory = memories.map((memory) => memory.body).join('\n')

    expect(combinedMemory).toContain('玄铁剑裂纹')
    expect(combinedMemory).not.toContain('未来答案')
    expect(
      memories.some((memory) => memory.source.includes('other-thread')),
    ).toBe(false)
  })

  it('keeps available L3 summary recall entries when no other channel competes', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-006',
      title: '第006章 剑阁回声',
      path: 'manuscript/volume-001/chapter-006.md',
      order: 6,
      content: '沈微握住玄铁剑时，李长老忽然沉默。',
    }
    const previousChapters = Array.from({ length: 5 }, (_, index) => ({
      ...project.chapters[0],
      id: `chapter-00${index + 1}`,
      title: `第00${index + 1}章 旧事${index + 1}`,
      path: `manuscript/volume-001/chapter-00${index + 1}.md`,
      order: index + 1,
      content: `第${index + 1}段旧事里，玄铁剑和李长老留下线索。`,
    }))
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [...previousChapters, chapter],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: previousChapters.map((previousChapter) => ({
        chapterId: previousChapter.id,
        chapterTitle: previousChapter.title,
        summary: `${previousChapter.title}里，玄铁剑和李长老留下不同线索。`,
        keyEvents: [],
        charactersInvolved: [],
        sourceHash: previousChapter.id,
        isEdited: false,
        updatedAt: '2026-06-25T00:00:00.000Z',
      })),
      projectTitle: project.title,
      budgetChars: 2_400,
    })
    const recallMemories = memories.filter((memory) =>
      memory.source.startsWith('recall:chapter_summary:'),
    )

    expect(recallMemories).toHaveLength(previousChapters.length)
    expect(recallMemories.map((memory) => memory.source)).toEqual([
      'recall:chapter_summary:chapter-005',
      'recall:chapter_summary:chapter-004',
      'recall:chapter_summary:chapter-003',
      'recall:chapter_summary:chapter-002',
      'recall:chapter_summary:chapter-001',
    ])
  })

  it('reserves L3 recall slots for indexed and plot-thread channels before filling with summary recalls', () => {
    const project = loadDemoProject()
    const chapter = {
      ...project.chapters[0],
      id: 'chapter-006',
      title: '第006章 镜湖折返',
      path: 'manuscript/volume-001/chapter-006.md',
      order: 6,
      content: '沈微握住玄铁剑，镜湖钥和裂纹旧事一齐涌回心头。',
    }
    const previousChapters = Array.from({ length: 5 }, (_, index) => ({
      ...project.chapters[0],
      id: `chapter-00${index + 1}`,
      title: `第00${index + 1}章 旧事${index + 1}`,
      path: `manuscript/volume-001/chapter-00${index + 1}.md`,
      order: index + 1,
      content: `第${index + 1}段旧事里，玄铁剑和李长老留下线索。`,
    }))
    const memories = buildNarrativeMemories({
      chapter,
      projectChapters: [...previousChapters, chapter],
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries: previousChapters.map((previousChapter) => ({
        chapterId: previousChapter.id,
        chapterTitle: previousChapter.title,
        summary: `${previousChapter.title}里，玄铁剑和李长老留下不同线索。`,
        keyEvents: [],
        charactersInvolved: [],
        sourceHash: previousChapter.id,
        isEdited: false,
        updatedAt: '2026-06-25T00:00:00.000Z',
      })),
      plotThreads: [
        {
          id: 'thread-1',
          title: '玄铁剑裂纹',
          content: '玄铁剑第一次低鸣时出现裂纹，来源尚未揭示。',
          plantedChapterId: previousChapters[0].id,
          plantedChapterTitle: previousChapters[0].title,
          keywords: ['玄铁剑', '裂纹'],
          status: 'open',
          confirmed: true,
          sourceSkillId: 'xuanhuan.foreshadowing_review',
          confirmedAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
        },
      ],
      indexedRecallResults: [
        {
          chapterId: previousChapters[0].id,
          chapterTitle: previousChapters[0].title,
          sourcePath: previousChapters[0].path,
          snippet: '镜湖钥第一次在旧誓里被提及。',
          score: 0.95,
          source: 'summary',
        },
        {
          chapterId: previousChapters[1].id,
          chapterTitle: previousChapters[1].title,
          sourcePath: previousChapters[1].path,
          snippet: '沈微在石阶背面看见镜湖旧刻。',
          score: 0.92,
          source: 'content',
        },
      ],
      projectTitle: project.title,
      budgetChars: 2_800,
    })

    const recallSources = memories
      .filter((memory) => memory.source.startsWith('recall:'))
      .map((memory) => memory.source)

    expect(recallSources).toContain('recall:plot_thread:thread-1')
    expect(recallSources).toContain('recall:index:chapter-001')
    expect(recallSources).toContain('recall:index:chapter-002')
    expect(
      recallSources.some((source) => source.startsWith('recall:chapter_summary:')),
    ).toBe(true)
  })
})
