import { describe, expect, it } from 'vitest'
import { createMemoryChapterVersionStore } from './chapterVersionStore'

describe('chapter version store', () => {
  it('stores a full chapter snapshot before an AI rewrite is accepted', () => {
    const store = createMemoryChapterVersionStore()
    const version = store.createSnapshot({
      chapterId: 'chapter-001',
      contentSnapshot: '改写前正文',
      source: 'ai',
      operation: 'rewrite_accept',
      note: '接受 AI 改写前自动快照',
      modelId: 'mock.local',
      skillId: 'xuanhuan.dialogue_polish',
    })

    expect(version.contentSnapshot).toBe('改写前正文')
    expect(version.source).toBe('ai')
    expect(version.skillId).toBe('xuanhuan.dialogue_polish')
  })

  it('lists versions for one chapter without leaking other chapter history', () => {
    const store = createMemoryChapterVersionStore()

    store.createSnapshot({
      chapterId: 'chapter-001',
      contentSnapshot: '第一章',
      source: 'manual',
      operation: 'snapshot',
    })
    store.createSnapshot({
      chapterId: 'chapter-002',
      contentSnapshot: '第二章',
      source: 'manual',
      operation: 'snapshot',
    })

    expect(store.listChapterVersions('chapter-001')).toHaveLength(1)
    expect(store.listChapterVersions('chapter-001')[0].contentSnapshot).toBe('第一章')
  })

  it('can be initialized from cached chapter versions', () => {
    const store = createMemoryChapterVersionStore([
      {
        id: 'version-cached',
        chapterId: 'chapter-001',
        contentSnapshot: '缓存正文',
        createdAt: '2026-06-25T00:00:00.000Z',
        source: 'manual',
        operation: 'snapshot',
        note: '历史快照',
      },
    ])

    expect(store.listChapterVersions('chapter-001')).toMatchObject([
      {
        id: 'version-cached',
        contentSnapshot: '缓存正文',
        note: '历史快照',
      },
    ])
  })
})
