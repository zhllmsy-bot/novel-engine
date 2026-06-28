import { describe, expect, it, vi } from 'vitest'
import { createChapterSummaryPersistence } from './chapterSummaryPersistence'
import type { ChapterSummary } from '../memory/chapterSummaryStore'

const summary: ChapterSummary = {
  chapterId: 'chapter-001',
  chapterTitle: '第一章',
  summary: '沈微听见玄铁剑的声音。',
  keyEvents: ['玄铁剑第一次回应沈微。'],
  charactersInvolved: ['char-li-zhanglao'],
  sourceHash: '42:40:沈微',
  isEdited: false,
  updatedAt: '2026-06-25T00:00:00.000Z',
}

describe('chapter summary persistence', () => {
  it('does not touch Tauri summary commands in the browser demo runtime', async () => {
    const listSummaries = vi.fn()
    const upsertSummary = vi.fn()
    const persistence = createChapterSummaryPersistence({
      detector: { isTauri: () => false },
      listSummaries,
      upsertSummary,
    })

    await expect(persistence.loadChapterSummaries('/novel')).resolves.toEqual([])
    await persistence.saveChapterSummary('/novel', summary)

    expect(listSummaries).not.toHaveBeenCalled()
    expect(upsertSummary).not.toHaveBeenCalled()
  })

  it('loads cached Tauri summaries into the memory summary shape', async () => {
    const persistence = createChapterSummaryPersistence({
      detector: { isTauri: () => true },
      listSummaries: vi.fn().mockResolvedValue([
        {
          chapter_id: 'chapter-001',
          chapter_title: '第一章',
          source_hash: '42:40:沈微',
          summary: '沈微听见玄铁剑的声音。',
          key_events: ['玄铁剑第一次回应沈微。'],
          characters_involved: ['char-li-zhanglao'],
          is_edited: true,
          updated_at: '2026-06-25T00:00:00.000Z',
        },
      ]),
    })

    await expect(persistence.loadChapterSummaries('/novel')).resolves.toEqual([
      {
        ...summary,
        isEdited: true,
      },
    ])
  })

  it('writes memory summaries through the Tauri cache adapter', async () => {
    const upsertSummary = vi.fn().mockResolvedValue(undefined)
    const persistence = createChapterSummaryPersistence({
      detector: { isTauri: () => true },
      upsertSummary,
    })

    await persistence.saveChapterSummary('/novel', summary)

    expect(upsertSummary).toHaveBeenCalledWith('/novel', {
      chapter_id: 'chapter-001',
      source_hash: '42:40:沈微',
      summary: '沈微听见玄铁剑的声音。',
      key_events: ['玄铁剑第一次回应沈微。'],
      characters_involved: ['char-li-zhanglao'],
      is_edited: false,
      updated_at: '2026-06-25T00:00:00.000Z',
    })
  })

  it('propagates cache persistence failures', async () => {
    const persistence = createChapterSummaryPersistence({
      detector: { isTauri: () => true },
      upsertSummary: vi.fn().mockRejectedValue(new Error('cache locked')),
    })

    await expect(
      persistence.saveChapterSummary('/novel', summary),
    ).rejects.toThrow('cache locked')
  })
})
