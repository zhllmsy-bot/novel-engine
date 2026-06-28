import type { ProjectChapter } from '../project/projectTypes'
import type { ChapterSummary } from './chapterSummaryStore'

export type VolumeSummary = {
  volumeId: string
  volumeTitle: string
  summary: string
  keySignals: string[]
  chapterIds: string[]
  sourceHash: string
  isEdited: boolean
  updatedAt: string
}

export type GenerateVolumeSummaryInput = {
  volumeId: string
  volumeTitle: string
  chapterSummaries: ChapterSummary[]
}

export type VolumeSummaryStore = {
  getSummary(volumeId: string): VolumeSummary | undefined
  listSummaries(): VolumeSummary[]
  upsertGeneratedSummary(input: GenerateVolumeSummaryInput): VolumeSummary
  upsertEditedSummary(summary: VolumeSummary): VolumeSummary
}

export function createMemoryVolumeSummaryStore(
  initialSummaries: VolumeSummary[] = [],
): VolumeSummaryStore {
  const summaries = new Map(
    initialSummaries.map((summary) => [summary.volumeId, summary]),
  )

  return {
    getSummary(volumeId) {
      return summaries.get(volumeId)
    },
    listSummaries() {
      return [...summaries.values()].toSorted((left, right) =>
        left.volumeId.localeCompare(right.volumeId),
      )
    },
    upsertGeneratedSummary(input) {
      const existingSummary = summaries.get(input.volumeId)
      if (existingSummary?.isEdited) {
        return existingSummary
      }

      const summary = generateLocalVolumeSummary(input)
      summaries.set(input.volumeId, summary)
      return summary
    },
    upsertEditedSummary(summary) {
      const editedSummary = {
        ...summary,
        isEdited: true,
        updatedAt: new Date().toISOString(),
      }
      summaries.set(summary.volumeId, editedSummary)
      return editedSummary
    },
  }
}

export function generateLocalVolumeSummary(
  input: GenerateVolumeSummaryInput,
): VolumeSummary {
  const orderedSummaries = [...input.chapterSummaries]
  const keySignals = pickVolumeSignals(orderedSummaries)

  return {
    volumeId: input.volumeId,
    volumeTitle: input.volumeTitle,
    summary: truncateVolumeSummary(keySignals.join(' ')),
    keySignals,
    chapterIds: orderedSummaries.map((summary) => summary.chapterId),
    sourceHash: volumeSourceSignature(orderedSummaries),
    isEdited: false,
    updatedAt: new Date().toISOString(),
  }
}

export function buildLocalVolumeSummaries(input: {
  projectChapters: ProjectChapter[]
  chapterSummaries: ChapterSummary[]
}): VolumeSummary[] {
  const groupedSummaries = groupChapterSummariesByVolume(input)

  return [...groupedSummaries.entries()].map(([volumeId, summaries]) =>
    generateLocalVolumeSummary({
      volumeId,
      volumeTitle: titleForVolumeId(volumeId),
      chapterSummaries: summaries,
    }),
  )
}

export function chapterSummariesForVolume(input: {
  volumeId: string
  projectChapters: ProjectChapter[]
  chapterSummaries: ChapterSummary[]
}) {
  return groupChapterSummariesByVolume(input).get(input.volumeId) || []
}

export function volumeIdForChapter(chapter: ProjectChapter) {
  return volumeIdFromPath(chapter.path)
}

function groupChapterSummariesByVolume(input: {
  projectChapters: ProjectChapter[]
  chapterSummaries: ChapterSummary[]
}) {
  const chaptersById = new Map(
    input.projectChapters.map((chapter) => [chapter.id, chapter]),
  )
  const groupedSummaries = new Map<string, ChapterSummary[]>()

  for (const summary of input.chapterSummaries) {
    const chapter = chaptersById.get(summary.chapterId)
    if (!chapter) continue

    const volumeId = volumeIdForChapter(chapter)
    groupedSummaries.set(volumeId, [...(groupedSummaries.get(volumeId) || []), summary])
  }

  for (const [volumeId, summaries] of groupedSummaries.entries()) {
    groupedSummaries.set(
      volumeId,
      summaries.toSorted((left, right) => {
        const leftOrder = chaptersById.get(left.chapterId)?.order || 0
        const rightOrder = chaptersById.get(right.chapterId)?.order || 0

        return leftOrder - rightOrder || left.chapterId.localeCompare(right.chapterId)
      }),
    )
  }

  return groupedSummaries
}

function pickVolumeSignals(chapterSummaries: ChapterSummary[]) {
  const signals = chapterSummaries.flatMap((summary) =>
    summary.keyEvents.length > 0 ? summary.keyEvents : [summary.summary],
  )

  if (signals.length <= 6) {
    return uniqueStrings(signals).map((signal) => limitText(signal, 72))
  }

  return uniqueStrings([...signals.slice(0, 3), ...signals.slice(-3)]).map(
    (signal) => limitText(signal, 72),
  )
}

function truncateVolumeSummary(value: string) {
  const fallback = '暂无卷级摘要。'
  const summary = value.trim() || fallback

  return summary.length > 420 ? `${summary.slice(0, 419)}…` : summary
}

function volumeSourceSignature(chapterSummaries: ChapterSummary[]) {
  return chapterSummaries
    .map((summary) => `${summary.chapterId}:${summary.sourceHash}`)
    .join('|')
}

function volumeIdFromPath(path: string) {
  return (
    path
      .split('/')
      .find((segment) => /^volume[-_]/i.test(segment)) || 'volume-unknown'
  )
}

function titleForVolumeId(volumeId: string) {
  return volumeId
}

function limitText(value: string, maxChars: number) {
  const trimmed = value.trim()
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}…` : trimmed
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
