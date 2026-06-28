import {
  readProjectGraphSnapshot,
  writeProjectGraphSnapshot,
} from '../platform/tauriProject'
import { isTauriRuntime } from '../platform/runtime'
import {
  parseStoryGraphSnapshot,
  type StoryGraphSnapshot,
} from '../inspector/storyGraphSnapshot'

export type GraphSnapshotPersistence = {
  loadGraphSnapshot(rootPath: string): Promise<StoryGraphSnapshot | null>
  saveGraphSnapshot(
    rootPath: string,
    snapshot: StoryGraphSnapshot,
  ): Promise<void>
}
type TauriDetector = {
  isTauri(): boolean
}

type GraphSnapshotPersistenceOptions = {
  detector?: TauriDetector
  readSnapshot?: typeof readProjectGraphSnapshot
  writeSnapshot?: typeof writeProjectGraphSnapshot
}

export function createGraphSnapshotPersistence(
  options: GraphSnapshotPersistenceOptions = {},
): GraphSnapshotPersistence {
  const detector = options.detector || browserTauriDetector
  const readSnapshot = options.readSnapshot || readProjectGraphSnapshot
  const writeSnapshot = options.writeSnapshot || writeProjectGraphSnapshot

  return {
    async loadGraphSnapshot(rootPath) {
      if (!detector.isTauri()) {
        return null
      }

      const source = await readSnapshot(rootPath)
      return source ? parseStoryGraphSnapshot(JSON.parse(source)) : null
    },
    async saveGraphSnapshot(rootPath, snapshot) {
      if (!detector.isTauri()) {
        return
      }

      await writeSnapshot(rootPath, JSON.stringify(snapshot, null, 2))
    },
  }
}

export const browserTauriDetector: TauriDetector = {
  isTauri() {
    return isTauriRuntime()
  },
}
