import { describe, expect, it } from 'vitest'
import { loadDemoProject } from '../project/demoProjectRepository'
import { createPlotThreadStore } from './plotThreadStore'

describe('plot thread store', () => {
  it('confirms plot-thread proposals into auditable open threads', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const store = createPlotThreadStore()
    const thread = store.confirmProposal({
      plantedChapter: chapter,
      sourceSkillId: 'xuanhuan.foreshadowing_review',
      proposal: {
        title: '玄铁剑裂纹',
        content: '玄铁剑第一次低鸣时出现细小裂纹，来源尚未揭示。',
        plantedChapterId: chapter.id,
        keywords: ['玄铁剑', '裂纹', '玄铁剑'],
        relatedCharacters: ['沈微', '李长老'],
        evidence: '玄铁剑低鸣。',
      },
    })

    expect(thread).toMatchObject({
      title: '玄铁剑裂纹',
      plantedChapterId: chapter.id,
      plantedChapterTitle: chapter.title,
      status: 'open',
      confirmed: true,
      sourceSkillId: 'xuanhuan.foreshadowing_review',
    })
    expect(thread.id).toContain('plot:chapter-001')
    expect(thread.keywords).toEqual(['玄铁剑裂纹', '玄铁剑', '裂纹'])
    expect(store.listThreads()).toHaveLength(1)
  })

  it('marks confirmed threads resolved without deleting their audit trail', () => {
    const project = loadDemoProject()
    const plantedChapter = project.chapters[0]
    const resolvedChapter = {
      ...plantedChapter,
      id: 'chapter-002',
      title: '第002章 石阶问心',
      order: 2,
    }
    const store = createPlotThreadStore()
    const thread = store.confirmProposal({
      plantedChapter,
      sourceSkillId: 'xuanhuan.foreshadowing_review',
      proposal: {
        title: '玄铁剑裂纹',
        content: '玄铁剑裂纹的来源尚未揭示。',
        plantedChapterId: plantedChapter.id,
        keywords: ['玄铁剑', '裂纹'],
      },
    })

    const resolved = store.resolveThread({
      threadId: thread.id,
      resolvedChapter,
      resolution: '裂纹来自剑中旧封印松动。',
    })

    expect(resolved).toMatchObject({
      id: thread.id,
      status: 'resolved',
      resolvedChapterId: 'chapter-002',
      resolvedChapterTitle: '第002章 石阶问心',
      resolution: '裂纹来自剑中旧封印松动。',
      confirmed: true,
    })
    expect(store.listThreads()[0]).toBe(resolved)
  })
})
