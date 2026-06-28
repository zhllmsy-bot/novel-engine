import { describe, expect, it } from 'vitest'
import type { ChapterSummary } from './chapterSummaryStore'
import {
  buildLocalVolumeSummaries,
  chapterSummariesForVolume,
  createMemoryVolumeSummaryStore,
  generateLocalVolumeSummary,
  volumeIdForChapter,
} from './volumeSummaryStore'

const chapterSummaries: ChapterSummary[] = Array.from({ length: 8 }, (_, index) => ({
  chapterId: `chapter-${String(index + 1).padStart(3, '0')}`,
  chapterTitle: `第${String(index + 1).padStart(3, '0')}章`,
  summary: `第${index + 1}章摘要。`,
  keyEvents: [`关键事件-${index + 1}`],
  charactersInvolved: [],
  sourceHash: `hash-${index + 1}`,
  isEdited: false,
  updatedAt: '2026-06-25T00:00:00.000Z',
}))

describe('volume summary store', () => {
  it('generates a compact volume summary from chapter summary signals', () => {
    const summary = generateLocalVolumeSummary({
      volumeId: 'volume-001',
      volumeTitle: '第一卷',
      chapterSummaries,
    })

    expect(summary).toMatchObject({
      volumeId: 'volume-001',
      volumeTitle: '第一卷',
      chapterIds: chapterSummaries.map((chapterSummary) => chapterSummary.chapterId),
      isEdited: false,
    })
    expect(summary.keySignals).toEqual([
      '关键事件-1',
      '关键事件-2',
      '关键事件-3',
      '关键事件-6',
      '关键事件-7',
      '关键事件-8',
    ])
    expect(summary.summary).toContain('关键事件-1')
    expect(summary.sourceHash).toContain('chapter-001:hash-1')
    expect(summary.sourceHash).toContain('chapter-008:hash-8')
  })

  it('does not overwrite edited volume summaries with generated cache data', () => {
    const store = createMemoryVolumeSummaryStore([
      {
        volumeId: 'volume-001',
        volumeTitle: '第一卷',
        summary: '作者手工整理的卷纲。',
        keySignals: ['作者钉住的线索'],
        chapterIds: ['chapter-001'],
        sourceHash: 'manual',
        isEdited: true,
        updatedAt: '2026-06-25T00:00:00.000Z',
      },
    ])

    const generated = store.upsertGeneratedSummary({
      volumeId: 'volume-001',
      volumeTitle: '第一卷',
      chapterSummaries,
    })

    expect(generated.summary).toBe('作者手工整理的卷纲。')
    expect(store.getSummary('volume-001')?.keySignals).toEqual(['作者钉住的线索'])
  })

  it('marks manually updated summaries as edited', () => {
    const store = createMemoryVolumeSummaryStore()
    const summary = store.upsertEditedSummary({
      volumeId: 'volume-001',
      volumeTitle: '第一卷',
      summary: '人工卷纲。',
      keySignals: ['线索'],
      chapterIds: ['chapter-001'],
      sourceHash: 'manual',
      isEdited: false,
      updatedAt: '2026-06-25T00:00:00.000Z',
    })

    expect(summary.isEdited).toBe(true)
    expect(store.listSummaries()).toHaveLength(1)
  })

  it('builds local volume summaries from project chapter paths', () => {
    const projectChapters = [
      {
        id: 'chapter-001',
        title: '第一章',
        status: '已摘要' as const,
        path: 'manuscript/volume-001/chapter-001.md',
        order: 1,
        content: '',
        wordCount: 0,
      },
      {
        id: 'chapter-002',
        title: '第二章',
        status: '已摘要' as const,
        path: 'manuscript/volume-001/chapter-002.md',
        order: 2,
        content: '',
        wordCount: 0,
      },
      {
        id: 'chapter-003',
        title: '第三章',
        status: '已摘要' as const,
        path: 'manuscript/volume-002/chapter-003.md',
        order: 3,
        content: '',
        wordCount: 0,
      },
    ]
    const summaries = chapterSummaries.slice(0, 3)
    const volumeSummaries = buildLocalVolumeSummaries({
      projectChapters,
      chapterSummaries: summaries,
    })

    expect(volumeIdForChapter(projectChapters[0])).toBe('volume-001')
    expect(
      chapterSummariesForVolume({
        volumeId: 'volume-001',
        projectChapters,
        chapterSummaries: summaries,
      }).map((summary) => summary.chapterId),
    ).toEqual(['chapter-001', 'chapter-002'])
    expect(volumeSummaries.map((summary) => summary.volumeId)).toEqual([
      'volume-001',
      'volume-002',
    ])
    expect(volumeSummaries[0].chapterIds).toEqual(['chapter-001', 'chapter-002'])
    expect(volumeSummaries[1].chapterIds).toEqual(['chapter-003'])
  })
})
