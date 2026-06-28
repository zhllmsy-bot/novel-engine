export type ChapterVersionSource = 'manual' | 'ai'

export type ChapterVersion = {
  id: string
  chapterId: string
  contentSnapshot: string
  createdAt: string
  source: ChapterVersionSource
  operation: 'snapshot' | 'rewrite_accept'
  note?: string
  modelId?: string
  skillId?: string
}

export type CreateChapterVersionInput = {
  chapterId: string
  contentSnapshot: string
  source: ChapterVersionSource
  operation: ChapterVersion['operation']
  note?: string
  modelId?: string
  skillId?: string
}

export type ChapterVersionStore = {
  createSnapshot(input: CreateChapterVersionInput): ChapterVersion
  listChapterVersions(chapterId: string): ChapterVersion[]
}

export function createMemoryChapterVersionStore(
  initialVersions: ChapterVersion[] = [],
): ChapterVersionStore {
  const versions: ChapterVersion[] = [...initialVersions]

  return {
    createSnapshot(input) {
      const version: ChapterVersion = {
        id: `version-${versions.length + 1}`,
        chapterId: input.chapterId,
        contentSnapshot: input.contentSnapshot,
        createdAt: new Date().toISOString(),
        source: input.source,
        operation: input.operation,
        note: input.note,
        modelId: input.modelId,
        skillId: input.skillId,
      }

      versions.push(version)
      return version
    },
    listChapterVersions(chapterId) {
      return versions
        .filter((version) => version.chapterId === chapterId)
        .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    },
  }
}
