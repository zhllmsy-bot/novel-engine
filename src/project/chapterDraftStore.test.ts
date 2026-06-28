import { describe, expect, it } from 'vitest'
import type { ProjectChapter } from './projectTypes'
import { createChapterDraftStore } from './chapterDraftStore'

const chapter: ProjectChapter = {
  id: 'chapter-001',
  title: '第001章',
  status: '编辑中',
  path: 'manuscript/volume-001/chapter-001.md',
  order: 1,
  content: '初始正文',
  wordCount: 4,
}

describe('chapter draft store', () => {
  it('marks a chapter dirty when content differs from persisted markdown', () => {
    const store = createChapterDraftStore([chapter])
    const draft = store.updateDraft('chapter-001', '修改后正文')

    expect(draft.status).toBe('dirty')
    expect(draft.persistedContent).toBe('初始正文')
  })

  it('marks a draft saved and advances the persisted content', () => {
    const store = createChapterDraftStore([chapter])

    store.updateDraft('chapter-001', '修改后正文')
    const saved = store.saveDraft('chapter-001')

    expect(saved.status).toBe('saved')
    expect(saved.persistedContent).toBe('修改后正文')
    expect(saved.savedAt).toBeTruthy()
  })

  it('returns to clean when content matches the persisted markdown again', () => {
    const store = createChapterDraftStore([chapter])

    store.updateDraft('chapter-001', '修改后正文')
    const draft = store.updateDraft('chapter-001', '初始正文')

    expect(draft.status).toBe('clean')
  })
})
