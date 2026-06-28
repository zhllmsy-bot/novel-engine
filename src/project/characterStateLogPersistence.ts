import type { CharacterStateLog } from '../memory/characterStateLogStore'
import {
  insertProjectCharacterStateLog,
  listProjectCharacterStateLogs,
  type CachedCharacterStateLog,
  type CharacterStateLogInsert,
} from '../platform/tauriProject'
import { isTauriRuntime } from '../platform/runtime'

export type CharacterStateLogPersistence = {
  loadCharacterStateLogs(rootPath: string): Promise<CharacterStateLog[]>
  saveCharacterStateLog(rootPath: string, log: CharacterStateLog): Promise<void>
}

type TauriDetector = {
  isTauri(): boolean
}

type CharacterStateLogPersistenceOptions = {
  detector?: TauriDetector
  listLogs?: typeof listProjectCharacterStateLogs
  insertLog?: typeof insertProjectCharacterStateLog
}

export function createCharacterStateLogPersistence(
  options: CharacterStateLogPersistenceOptions = {},
): CharacterStateLogPersistence {
  const detector = options.detector || browserTauriDetector
  const listLogs = options.listLogs || listProjectCharacterStateLogs
  const insertLog = options.insertLog || insertProjectCharacterStateLog

  return {
    async loadCharacterStateLogs(rootPath) {
      if (!detector.isTauri()) {
        return []
      }

      const cachedLogs = await listLogs(rootPath)
      return cachedLogs.map(logFromCache)
    },
    async saveCharacterStateLog(rootPath, log) {
      if (!detector.isTauri()) {
        return
      }

      await insertLog(rootPath, logToCache(log))
    },
  }
}

export const browserTauriDetector: TauriDetector = {
  isTauri() {
    return isTauriRuntime()
  },
}

function logFromCache(log: CachedCharacterStateLog): CharacterStateLog {
  return {
    kind: 'character_state',
    id: log.id,
    chapterId: log.chapter_id,
    chapterTitle: log.chapter_title,
    characterName: log.character_name,
    field: log.field,
    from: log.from_value,
    to: log.to_value,
    reason: log.reason,
    evidence: log.evidence,
    confidence: log.confidence,
    sourceSkillId: log.source_skill_id,
    confirmedAt: log.confirmed_at,
  }
}

function logToCache(log: CharacterStateLog): CharacterStateLogInsert {
  return {
    id: log.id,
    chapter_id: log.chapterId,
    chapter_title: log.chapterTitle,
    character_name: log.characterName,
    field: log.field,
    from_value: log.from,
    to_value: log.to,
    reason: log.reason,
    evidence: log.evidence,
    confidence: log.confidence,
    source_skill_id: log.sourceSkillId,
    confirmed_at: log.confirmedAt,
  }
}
