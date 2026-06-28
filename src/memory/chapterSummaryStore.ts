import type { CodexEntry, ProjectChapter } from '../project/projectTypes'

export type ChapterSummary = {
  chapterId: string
  chapterTitle: string
  summary: string
  keyEvents: string[]
  charactersInvolved: string[]
  sourceHash: string
  isEdited: boolean
  updatedAt: string
}

export type GenerateChapterSummaryInput = {
  chapter: ProjectChapter
  content: string
  codexEntries: CodexEntry[]
}

export type ModelChapterSummaryInput = {
  chapter: ProjectChapter
  content: string
  summary: string
  keyEvents: string[]
  charactersInvolved: string[]
}

export type ChapterSummaryStore = {
  getSummary(chapterId: string): ChapterSummary | undefined
  listSummaries(): ChapterSummary[]
  upsertGeneratedSummary(input: GenerateChapterSummaryInput): ChapterSummary
  upsertModelSummary(input: ModelChapterSummaryInput): ChapterSummary
  upsertEditedSummary(summary: ChapterSummary): ChapterSummary
}

export function createMemoryChapterSummaryStore(
  initialSummaries: ChapterSummary[] = [],
): ChapterSummaryStore {
  const summaries = new Map(
    initialSummaries.map((summary) => [summary.chapterId, summary]),
  )

  return {
    getSummary(chapterId) {
      return summaries.get(chapterId)
    },
    listSummaries() {
      return [...summaries.values()].toSorted((left, right) =>
        left.chapterId.localeCompare(right.chapterId),
      )
    },
    upsertGeneratedSummary(input) {
      const existingSummary = summaries.get(input.chapter.id)
      if (existingSummary?.isEdited) {
        return existingSummary
      }

      const summary = generateLocalChapterSummary(input)
      summaries.set(input.chapter.id, summary)
      return summary
    },
    upsertModelSummary(input) {
      const existingSummary = summaries.get(input.chapter.id)
      if (existingSummary?.isEdited) {
        return existingSummary
      }

      const summary = {
        chapterId: input.chapter.id,
        chapterTitle: input.chapter.title,
        summary: truncateSummary(input.summary),
        keyEvents: input.keyEvents.map((event) => event.trim()).filter(Boolean),
        charactersInvolved: input.charactersInvolved
          .map((character) => character.trim())
          .filter(Boolean),
        sourceHash: sourceSignature(input.content),
        isEdited: false,
        updatedAt: new Date().toISOString(),
      }
      summaries.set(input.chapter.id, summary)
      return summary
    },
    upsertEditedSummary(summary) {
      const editedSummary = {
        ...summary,
        isEdited: true,
        updatedAt: new Date().toISOString(),
      }
      summaries.set(summary.chapterId, editedSummary)
      return editedSummary
    },
  }
}

export function generateLocalChapterSummary(
  input: GenerateChapterSummaryInput,
): ChapterSummary {
  const sentences = usefulSentences(input.content)
  const keyEvents = sentences.slice(0, 3)
  const charactersInvolved = input.codexEntries
    .filter((entry) =>
      [entry.name, ...entry.keywords].some((keyword) =>
        keyword ? input.content.includes(keyword) : false,
      ),
    )
    .map((entry) => entry.id)

  return {
    chapterId: input.chapter.id,
    chapterTitle: input.chapter.title,
    summary: truncateSummary(keyEvents.join(' ')),
    keyEvents,
    charactersInvolved,
    sourceHash: sourceSignature(input.content),
    isEdited: false,
    updatedAt: new Date().toISOString(),
  }
}

function usefulSentences(content: string) {
  const body = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .join(' ')

  return (
    body
      .split(/(?<=[。！？!?])\s*/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, 6)
  )
}

function truncateSummary(value: string) {
  const fallback = '暂无摘要。'
  const summary = value.trim() || fallback

  return summary.length > 220 ? `${summary.slice(0, 219)}…` : summary
}

function sourceSignature(value: string) {
  const compact = value.replace(/\s/g, '')
  return `${value.length}:${compact.length}:${compact.slice(0, 12)}`
}
