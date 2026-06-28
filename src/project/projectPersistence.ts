import { writeProjectChapter } from '../platform/tauriProject'
import { isTauriRuntime } from '../platform/runtime'

export type ProjectPersistence = {
  saveChapter(path: string, content: string): Promise<void>
}

type TauriDetector = {
  isTauri(): boolean
}

type ProjectPersistenceOptions = {
  detector?: TauriDetector
  writeChapter?: typeof writeProjectChapter
}

export function createProjectPersistence(
  options: ProjectPersistenceOptions = {},
): ProjectPersistence {
  const detector = options.detector || browserTauriDetector
  const writeChapter = options.writeChapter || writeProjectChapter

  return {
    async saveChapter(path, content) {
      if (!detector.isTauri()) {
        return
      }

      await writeChapter(path, content)
    },
  }
}

export const browserTauriDetector: TauriDetector = {
  isTauri() {
    return isTauriRuntime()
  },
}
