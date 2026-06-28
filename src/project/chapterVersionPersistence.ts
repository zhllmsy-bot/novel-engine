import {
  type ChapterVersion,
  type ChapterVersionSource,
} from '../versioning/chapterVersionStore'
import {
  insertProjectChapterVersion,
  listProjectChapterVersions,
  type CachedChapterVersion,
  type ChapterVersionInsert,
} from '../platform/tauriProject'
import { isTauriRuntime } from '../platform/runtime'

export type ChapterVersionPersistence = {
  loadChapterVersions(rootPath: string): Promise<ChapterVersion[]>
  saveChapterVersion(rootPath: string, version: ChapterVersion): Promise<void>
}

type TauriDetector = {
  isTauri(): boolean
}

type ChapterVersionPersistenceOptions = {
  detector?: TauriDetector
  listVersions?: typeof listProjectChapterVersions
  insertVersion?: typeof insertProjectChapterVersion
}

export function createChapterVersionPersistence(
  options: ChapterVersionPersistenceOptions = {},
): ChapterVersionPersistence {
  const detector = options.detector || browserTauriDetector
  const listVersions = options.listVersions || listProjectChapterVersions
  const insertVersion = options.insertVersion || insertProjectChapterVersion

  return {
    async loadChapterVersions(rootPath) {
      if (!detector.isTauri()) {
        return []
      }

      const cachedVersions = await listVersions(rootPath)
      return cachedVersions.map(versionFromCache)
    },
    async saveChapterVersion(rootPath, version) {
      if (!detector.isTauri()) {
        return
      }

      await insertVersion(rootPath, versionToCache(version))
    },
  }
}

export const browserTauriDetector: TauriDetector = {
  isTauri() {
    return isTauriRuntime()
  },
}

function versionFromCache(version: CachedChapterVersion): ChapterVersion {
  return {
    id: version.id,
    chapterId: version.chapter_id,
    contentSnapshot: version.content_snapshot,
    createdAt: version.created_at,
    source: normalizeSource(version.source),
    operation:
      version.operation === 'rewrite_accept' ? 'rewrite_accept' : 'snapshot',
    note: version.note,
    modelId: version.model_id,
    skillId: version.skill_id,
  }
}

function versionToCache(version: ChapterVersion): ChapterVersionInsert {
  return {
    id: version.id,
    chapter_id: version.chapterId,
    content_snapshot: version.contentSnapshot,
    created_at: version.createdAt,
    source: version.source,
    operation: version.operation,
    note: version.note,
    model_id: version.modelId,
    skill_id: version.skillId,
  }
}

function normalizeSource(source: string): ChapterVersionSource {
  return source === 'ai' ? 'ai' : 'manual'
}
