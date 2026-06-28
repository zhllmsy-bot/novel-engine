import { describe, expect, it, vi } from 'vitest'
import type { VolumeSummary } from '../memory/volumeSummaryStore'
import { createVolumeSummaryPersistence } from './volumeSummaryPersistence'

const summary: VolumeSummary = {
  volumeId: 'volume-001',
  volumeTitle: '第一卷 山门旧账',
  summary: '沈微入玄天宗后，玄铁剑与师父旧账成为第一卷主线。',
  keySignals: ['玄铁剑', '师父旧账'],
  chapterIds: ['chapter-001', 'chapter-002'],
  sourceHash: 'volume-hash',
  isEdited: false,
  updatedAt: '2026-06-25T00:00:00.000Z',
}

describe('volume summary persistence', () => {
  it('does not touch Tauri volume-summary commands in the browser demo runtime', async () => {
    const listSummaries = vi.fn()
    const upsertSummary = vi.fn()
    const persistence = createVolumeSummaryPersistence({
      detector: { isTauri: () => false },
      listSummaries,
      upsertSummary,
    })

    await expect(persistence.loadVolumeSummaries('/novel')).resolves.toEqual([])
    await persistence.saveVolumeSummary('/novel', summary)

    expect(listSummaries).not.toHaveBeenCalled()
    expect(upsertSummary).not.toHaveBeenCalled()
  })

  it('loads cached Tauri volume summaries into the memory shape', async () => {
    const persistence = createVolumeSummaryPersistence({
      detector: { isTauri: () => true },
      listSummaries: vi.fn().mockResolvedValue([
        {
          volume_id: 'volume-001',
          volume_title: '第一卷 山门旧账',
          source_hash: 'volume-hash',
          summary: '沈微入玄天宗后，玄铁剑与师父旧账成为第一卷主线。',
          key_signals: ['玄铁剑', '师父旧账'],
          chapter_ids: ['chapter-001', 'chapter-002'],
          is_edited: true,
          updated_at: '2026-06-25T00:00:00.000Z',
        },
      ]),
    })

    await expect(persistence.loadVolumeSummaries('/novel')).resolves.toEqual([
      {
        ...summary,
        isEdited: true,
      },
    ])
  })

  it('writes volume summaries through the Tauri cache adapter', async () => {
    const upsertSummary = vi.fn().mockResolvedValue(undefined)
    const persistence = createVolumeSummaryPersistence({
      detector: { isTauri: () => true },
      upsertSummary,
    })

    await persistence.saveVolumeSummary('/novel', summary)

    expect(upsertSummary).toHaveBeenCalledWith('/novel', {
      volume_id: 'volume-001',
      volume_title: '第一卷 山门旧账',
      source_hash: 'volume-hash',
      summary: '沈微入玄天宗后，玄铁剑与师父旧账成为第一卷主线。',
      key_signals: ['玄铁剑', '师父旧账'],
      chapter_ids: ['chapter-001', 'chapter-002'],
      is_edited: false,
      updated_at: '2026-06-25T00:00:00.000Z',
    })
  })

  it('propagates cache persistence failures', async () => {
    const persistence = createVolumeSummaryPersistence({
      detector: { isTauri: () => true },
      upsertSummary: vi.fn().mockRejectedValue(new Error('cache locked')),
    })

    await expect(
      persistence.saveVolumeSummary('/novel', summary),
    ).rejects.toThrow('cache locked')
  })
})
