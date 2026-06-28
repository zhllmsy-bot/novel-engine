import { describe, expect, it, vi } from 'vitest'
import { createChapterVersionPersistence } from './chapterVersionPersistence'
import type { ChapterVersion } from '../versioning/chapterVersionStore'

const version: ChapterVersion = {
  id: 'version-1',
  chapterId: 'chapter-001',
  contentSnapshot: '改写前正文',
  createdAt: '2026-06-25T00:00:00.000Z',
  source: 'ai',
  operation: 'rewrite_accept',
  note: '接受 AI 改写前自动快照',
  modelId: 'mock.local',
  skillId: 'xuanhuan.dialogue_polish',
}

describe('chapter version persistence', () => {
  it('does not touch Tauri version commands in the browser demo runtime', async () => {
    const listVersions = vi.fn()
    const insertVersion = vi.fn()
    const persistence = createChapterVersionPersistence({
      detector: { isTauri: () => false },
      listVersions,
      insertVersion,
    })

    await expect(persistence.loadChapterVersions('/novel')).resolves.toEqual([])
    await persistence.saveChapterVersion('/novel', version)

    expect(listVersions).not.toHaveBeenCalled()
    expect(insertVersion).not.toHaveBeenCalled()
  })

  it('loads cached Tauri versions into the memory version shape', async () => {
    const persistence = createChapterVersionPersistence({
      detector: { isTauri: () => true },
      listVersions: vi.fn().mockResolvedValue([
        {
          id: 'version-1',
          chapter_id: 'chapter-001',
          content_snapshot: '改写前正文',
          created_at: '2026-06-25T00:00:00.000Z',
          source: 'ai',
          operation: 'rewrite_accept',
          note: '接受 AI 改写前自动快照',
          model_id: 'mock.local',
          skill_id: 'xuanhuan.dialogue_polish',
        },
      ]),
    })

    await expect(persistence.loadChapterVersions('/novel')).resolves.toEqual([
      version,
    ])
  })

  it('writes memory versions through the Tauri cache adapter', async () => {
    const insertVersion = vi.fn().mockResolvedValue(undefined)
    const persistence = createChapterVersionPersistence({
      detector: { isTauri: () => true },
      insertVersion,
    })

    await persistence.saveChapterVersion('/novel', version)

    expect(insertVersion).toHaveBeenCalledWith('/novel', {
      id: 'version-1',
      chapter_id: 'chapter-001',
      content_snapshot: '改写前正文',
      created_at: '2026-06-25T00:00:00.000Z',
      source: 'ai',
      operation: 'rewrite_accept',
      note: '接受 AI 改写前自动快照',
      model_id: 'mock.local',
      skill_id: 'xuanhuan.dialogue_polish',
    })
  })

  it('propagates cache persistence failures', async () => {
    const persistence = createChapterVersionPersistence({
      detector: { isTauri: () => true },
      insertVersion: vi.fn().mockRejectedValue(new Error('cache locked')),
    })

    await expect(
      persistence.saveChapterVersion('/novel', version),
    ).rejects.toThrow('cache locked')
  })
})
