import type { ProjectChapter } from './projectTypes'

export type ChapterDraft = {
  chapterId: string
  content: string
  persistedContent: string
  status: 'clean' | 'dirty' | 'saved'
  savedAt?: string
}

export type ChapterDraftStore = {
  getDraft(chapterId: string): ChapterDraft | undefined
  updateDraft(chapterId: string, content: string): ChapterDraft
  saveDraft(chapterId: string): ChapterDraft
}

export function createChapterDraftStore(
  chapters: ProjectChapter[],
): ChapterDraftStore {
  const drafts = new Map<string, ChapterDraft>(
    chapters.map((chapter) => [
      chapter.id,
      {
        chapterId: chapter.id,
        content: chapter.content,
        persistedContent: chapter.content,
        status: 'clean',
      },
    ]),
  )

  return {
    getDraft(chapterId) {
      return drafts.get(chapterId)
    },
    updateDraft(chapterId, content) {
      const draft = mustGetDraft(drafts, chapterId)
      const nextDraft: ChapterDraft = {
        ...draft,
        content,
        status:
          content === draft.persistedContent
            ? draft.status === 'saved'
              ? 'saved'
              : 'clean'
            : 'dirty',
      }
      drafts.set(chapterId, nextDraft)
      return nextDraft
    },
    saveDraft(chapterId) {
      const draft = mustGetDraft(drafts, chapterId)
      const nextDraft: ChapterDraft = {
        ...draft,
        persistedContent: draft.content,
        status: 'saved',
        savedAt: new Date().toISOString(),
      }
      drafts.set(chapterId, nextDraft)
      return nextDraft
    },
  }
}

function mustGetDraft(
  drafts: Map<string, ChapterDraft>,
  chapterId: string,
): ChapterDraft {
  const draft = drafts.get(chapterId)
  if (!draft) {
    throw new Error(`Unknown chapter draft: ${chapterId}`)
  }

  return draft
}
