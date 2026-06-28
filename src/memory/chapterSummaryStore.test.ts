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
})
