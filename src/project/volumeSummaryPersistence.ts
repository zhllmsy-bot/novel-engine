import type { VolumeSummary } from '../memory/volumeSummaryStore'
import { isTauriRuntime } from '../platform/runtime'
import {
  listProjectVolumeSummaries,
  upsertProjectVolumeSummary,
  type CachedVolumeSummary,
  type VolumeSummaryUpsert,
} from '../platform/tauriProject'

export type VolumeSummaryPersistence = {
  loadVolumeSummaries(rootPath: string): Promise<VolumeSummary[]>
  saveVolumeSummary(rootPath: string, summary: VolumeSummary): Promise<void>
}

type TauriDetector = {
  isTauri(): boolean
}

type VolumeSummaryPersistenceOptions = {
  detector?: TauriDetector
  listSummaries?: typeof listProjectVolumeSummaries
  upsertSummary?: typeof upsertProjectVolumeSummary
}

export function createVolumeSummaryPersistence(
  options: VolumeSummaryPersistenceOptions = {},
): VolumeSummaryPersistence {
  const detector = options.detector || browserTauriDetector
  const listSummaries = options.listSummaries || listProjectVolumeSummaries
  const upsertSummary = options.upsertSummary || upsertProjectVolumeSummary

  return {
    async loadVolumeSummaries(rootPath) {
      if (!detector.isTauri()) {
        return []
      }

      const cachedSummaries = await listSummaries(rootPath)
      return cachedSummaries.map(summaryFromCache)
    },
    async saveVolumeSummary(rootPath, summary) {
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

function summaryFromCache(summary: CachedVolumeSummary): VolumeSummary {
  return {
    volumeId: summary.volume_id,
    volumeTitle: summary.volume_title,
    summary: summary.summary,
    keySignals: summary.key_signals,
    chapterIds: summary.chapter_ids,
    sourceHash: summary.source_hash,
    isEdited: summary.is_edited,
    updatedAt: summary.updated_at,
  }
}

function summaryToCache(summary: VolumeSummary): VolumeSummaryUpsert {
  return {
    volume_id: summary.volumeId,
    volume_title: summary.volumeTitle,
    source_hash: summary.sourceHash,
    summary: summary.summary,
    key_signals: summary.keySignals,
    chapter_ids: summary.chapterIds,
    is_edited: summary.isEdited,
    updated_at: summary.updatedAt,
  }
}
