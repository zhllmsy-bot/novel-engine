import type { ChapterSummary } from '../memory/chapterSummaryStore'
import {
  listProjectChapterSummaries,
  upsertProjectChapterSummary,
  type CachedChapterSummary,
  type ChapterSummaryUpsert,
} from '../platform/tauriProject'
import { isTauriRuntime } from '../platform/runtime'

export type ChapterSummaryPersistence = {
  loadChapterSummaries(rootPath: string): Promise<ChapterSummary[]>
  saveChapterSummary(rootPath: string, summary: ChapterSummary): Promise<void>
}

type TauriDetector = {
  isTauri(): boolean
}

type ChapterSummaryPersistenceOptions = {
  detector?: TauriDetector
  listSummaries?: typeof listProjectChapterSummaries
  upsertSummary?: typeof upsertProjectChapterSummary
}

export function createChapterSummaryPersistence(
  options: ChapterSummaryPersistenceOptions = {},
): ChapterSummaryPersistence {
  const detector = options.detector || browserTauriDetector
  const listSummaries = options.listSummaries || listProjectChapterSummaries
  const upsertSummary = options.upsertSummary || upsertProjectChapterSummary

  return {
    async loadChapterSummaries(rootPath) {
      if (!detector.isTauri()) {
        return []
      }

      const cachedSummaries = await listSummaries(rootPath)
      return cachedSummaries.map(summaryFromCache)
    },
    async saveChapterSummary(rootPath, summary) {
      if (!detector.isTauri()) {
        return
      }

      await upsertSummary(rootPath, summaryToCache(summary))
    },
  }
}

export const browserTauriDetector: TauriDetector = {
  isTauri() {
    return isTauriRuntime()
  },
}

function summaryFromCache(summary: CachedChapterSummary): ChapterSummary {
  return {
    chapterId: summary.chapter_id,
    chapterTitle: summary.chapter_title,
    summary: summary.summary,
    keyEvents: summary.key_events,
    charactersInvolved: summary.characters_involved,
    sourceHash: summary.source_hash,
    isEdited: summary.is_edited,
    updatedAt: summary.updated_at,
  }
}

function summaryToCache(summary: ChapterSummary): ChapterSummaryUpsert {
  return {
    chapter_id: summary.chapterId,
    source_hash: summary.sourceHash,
    summary: summary.summary,
    key_events: summary.keyEvents,
    characters_involved: summary.charactersInvolved,
    is_edited: summary.isEdited,
    updated_at: summary.updatedAt,
  }
}
