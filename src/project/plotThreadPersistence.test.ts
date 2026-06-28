import { describe, expect, it, vi } from 'vitest'
import type { PlotThread } from '../memory/plotThreadStore'
import { createPlotThreadPersistence } from './plotThreadPersistence'

const thread: PlotThread = {
  id: 'plot:chapter-001:玄铁剑裂纹:1',
  title: '玄铁剑裂纹',
  content: '玄铁剑裂纹来源尚未揭示。',
  plantedChapterId: 'chapter-001',
  plantedChapterTitle: '第001章 山门雨',
  keywords: ['玄铁剑', '裂纹'],
  relatedCharacters: ['沈微'],
  evidence: '剑身裂纹扩大。',
  status: 'open',
  confirmed: true,
  sourceSkillId: 'xuanhuan.foreshadowing_thread',
  confirmedAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
}

describe('plot thread persistence', () => {
  it('does not touch Tauri plot-thread commands in the browser demo runtime', async () => {
    const listThreads = vi.fn()
    const upsertThread = vi.fn()
    const persistence = createPlotThreadPersistence({
      detector: { isTauri: () => false },
      listThreads,
      upsertThread,
    })

    await expect(persistence.loadPlotThreads('/novel')).resolves.toEqual([])
    await persistence.savePlotThread('/novel', thread)

    expect(listThreads).not.toHaveBeenCalled()
    expect(upsertThread).not.toHaveBeenCalled()
  })

  it('loads cached Tauri plot threads into the memory shape', async () => {
    const persistence = createPlotThreadPersistence({
      detector: { isTauri: () => true },
      listThreads: vi.fn().mockResolvedValue([
        {
          id: 'plot:chapter-001:玄铁剑裂纹:1',
          title: '玄铁剑裂纹',
          content: '玄铁剑裂纹来源尚未揭示。',
          planted_chapter_id: 'chapter-001',
          planted_chapter_title: '第001章 山门雨',
          keywords: ['玄铁剑', '裂纹'],
          related_characters: ['沈微'],
          evidence: '剑身裂纹扩大。',
          status: 'resolved',
          resolved_chapter_id: 'chapter-009',
          resolved_chapter_title: '第009章 旧封印',
          resolution: '裂纹来自旧封印。',
          confirmed: true,
          source_skill_id: 'xuanhuan.foreshadowing_thread',
          confirmed_at: '2026-06-25T00:00:00.000Z',
          updated_at: '2026-06-25T00:10:00.000Z',
        },
      ]),
    })

    await expect(persistence.loadPlotThreads('/novel')).resolves.toEqual([
      {
        ...thread,
        status: 'resolved',
        resolvedChapterId: 'chapter-009',
        resolvedChapterTitle: '第009章 旧封印',
        resolution: '裂纹来自旧封印。',
        updatedAt: '2026-06-25T00:10:00.000Z',
      },
    ])
  })

  it('writes plot threads through the Tauri cache adapter', async () => {
    const upsertThread = vi.fn().mockResolvedValue(undefined)
    const persistence = createPlotThreadPersistence({
      detector: { isTauri: () => true },
      upsertThread,
    })

    await persistence.savePlotThread('/novel', thread)

    expect(upsertThread).toHaveBeenCalledWith('/novel', {
      id: 'plot:chapter-001:玄铁剑裂纹:1',
      title: '玄铁剑裂纹',
      content: '玄铁剑裂纹来源尚未揭示。',
      planted_chapter_id: 'chapter-001',
      planted_chapter_title: '第001章 山门雨',
      keywords: ['玄铁剑', '裂纹'],
      related_characters: ['沈微'],
      evidence: '剑身裂纹扩大。',
      status: 'open',
      resolved_chapter_id: undefined,
      resolved_chapter_title: undefined,
      resolution: undefined,
      confirmed: true,
      source_skill_id: 'xuanhuan.foreshadowing_thread',
      confirmed_at: '2026-06-25T00:00:00.000Z',
      updated_at: '2026-06-25T00:00:00.000Z',
    })
  })

  it('propagates cache persistence failures', async () => {
    const persistence = createPlotThreadPersistence({
      detector: { isTauri: () => true },
      upsertThread: vi.fn().mockRejectedValue(new Error('cache locked')),
    })

    await expect(persistence.savePlotThread('/novel', thread)).rejects.toThrow(
      'cache locked',
    )
  })
})
