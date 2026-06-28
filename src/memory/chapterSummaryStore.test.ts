import { describe, expect, it } from 'vitest'
import { loadDemoProject } from '../project/demoProjectRepository'
import { createMemoryChapterSummaryStore } from './chapterSummaryStore'

describe('chapter summary store', () => {
  it('generates a local chapter summary with key events and involved characters', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const store = createMemoryChapterSummaryStore()
    const summary = store.upsertGeneratedSummary({
      chapter,
      content: chapter.content,
      codexEntries: project.codexEntries,
    })

    expect(summary.summary).toContain('沈微第一次听见玄铁剑的声音')
    expect(summary.keyEvents.length).toBeGreaterThan(0)
    expect(summary.charactersInvolved).toContain('char-li-zhanglao')
    expect(summary.isEdited).toBe(false)
    expect(store.getSummary(chapter.id)).toBe(summary)
  })

  it('does not overwrite an edited summary with generated content', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const store = createMemoryChapterSummaryStore()
    const generated = store.upsertGeneratedSummary({
      chapter,
      content: chapter.content,
      codexEntries: project.codexEntries,
    })
    const edited = store.upsertEditedSummary({
      ...generated,
      summary: '人工校正后的摘要。',
    })

    const nextSummary = store.upsertGeneratedSummary({
      chapter,
      content: `${chapter.content}\n\n新增内容。`,
      codexEntries: project.codexEntries,
    })

    expect(nextSummary.summary).toBe('人工校正后的摘要。')
    expect(nextSummary.isEdited).toBe(true)
    expect(store.getSummary(chapter.id)).toBe(edited)
  })

  it('stores model-generated structured summaries as derived L1 memory', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const store = createMemoryChapterSummaryStore()
    const summary = store.upsertModelSummary({
      chapter,
      content: chapter.content,
      summary: '沈微在山门雨中听见玄铁剑震鸣，李长老以戒律堂施压，裂纹伏笔被重新点亮。',
      keyEvents: ['沈微听见玄铁剑。', '李长老施压。', '玄铁剑裂纹成为伏笔。'],
      charactersInvolved: ['沈微', '李长老'],
    })

    expect(summary.summary).toContain('裂纹伏笔')
    expect(summary.keyEvents).toEqual([
      '沈微听见玄铁剑。',
      '李长老施压。',
      '玄铁剑裂纹成为伏笔。',
    ])
    expect(summary.charactersInvolved).toEqual(['沈微', '李长老'])
    expect(summary.isEdited).toBe(false)
    expect(summary.sourceHash).toBeTruthy()
  })

  it('does not overwrite an edited summary with model-generated content', () => {
    const project = loadDemoProject()
    const chapter = project.chapters[0]
    const store = createMemoryChapterSummaryStore()
    const generated = store.upsertGeneratedSummary({
      chapter,
      content: chapter.content,
      codexEntries: project.codexEntries,
    })
    const edited = store.upsertEditedSummary({
      ...generated,
      summary: '作者锁定的人工摘要。',
    })

    const nextSummary = store.upsertModelSummary({
      chapter,
      content: `${chapter.content}\n\n新增内容。`,
      summary: '模型生成的新摘要。',
      keyEvents: ['新事件。'],
      charactersInvolved: ['沈微'],
    })

    expect(nextSummary.summary).toBe('作者锁定的人工摘要。')
    expect(nextSummary.isEdited).toBe(true)
    expect(store.getSummary(chapter.id)).toBe(edited)
  })
})
