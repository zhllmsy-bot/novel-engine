import type { PlotThread } from '../memory/plotThreadStore'
import {
  listProjectPlotThreads,
  upsertProjectPlotThread,
  type CachedPlotThread,
  type PlotThreadUpsert,
} from '../platform/tauriProject'
import { isTauriRuntime } from '../platform/runtime'

export type PlotThreadPersistence = {
  loadPlotThreads(rootPath: string): Promise<PlotThread[]>
  savePlotThread(rootPath: string, thread: PlotThread): Promise<void>
}

type TauriDetector = {
  isTauri(): boolean
}

type PlotThreadPersistenceOptions = {
  detector?: TauriDetector
  listThreads?: typeof listProjectPlotThreads
  upsertThread?: typeof upsertProjectPlotThread
}

export function createPlotThreadPersistence(
  options: PlotThreadPersistenceOptions = {},
): PlotThreadPersistence {
  const detector = options.detector || browserTauriDetector
  const listThreads = options.listThreads || listProjectPlotThreads
  const upsertThread = options.upsertThread || upsertProjectPlotThread

  return {
    async loadPlotThreads(rootPath) {
      if (!detector.isTauri()) {
        return []
      }

      const cachedThreads = await listThreads(rootPath)
      return cachedThreads.map(threadFromCache)
    },
    async savePlotThread(rootPath, thread) {
      if (!detector.isTauri()) {
        return
      }

      await upsertThread(rootPath, threadToCache(thread))
    },
  }
}

export const browserTauriDetector: TauriDetector = {
  isTauri() {
    return isTauriRuntime()
  },
}

function threadFromCache(thread: CachedPlotThread): PlotThread {
  return {
    id: thread.id,
    title: thread.title,
    content: thread.content,
    plantedChapterId: thread.planted_chapter_id,
    plantedChapterTitle: thread.planted_chapter_title,
    keywords: thread.keywords,
    relatedCharacters: thread.related_characters,
    evidence: thread.evidence,
    status: thread.status,
    resolvedChapterId: thread.resolved_chapter_id,
    resolvedChapterTitle: thread.resolved_chapter_title,
    resolution: thread.resolution,
    confirmed: true,
    sourceSkillId: thread.source_skill_id,
    confirmedAt: thread.confirmed_at,
    updatedAt: thread.updated_at,
  }
}

function threadToCache(thread: PlotThread): PlotThreadUpsert {
  return {
    id: thread.id,
    title: thread.title,
    content: thread.content,
    planted_chapter_id: thread.plantedChapterId,
    planted_chapter_title: thread.plantedChapterTitle,
    keywords: thread.keywords,
    related_characters: thread.relatedCharacters || [],
    evidence: thread.evidence,
    status: thread.status,
    resolved_chapter_id: thread.resolvedChapterId,
    resolved_chapter_title: thread.resolvedChapterTitle,
    resolution: thread.resolution,
    confirmed: thread.confirmed,
    source_skill_id: thread.sourceSkillId,
    confirmed_at: thread.confirmedAt,
    updated_at: thread.updatedAt,
  }
}
