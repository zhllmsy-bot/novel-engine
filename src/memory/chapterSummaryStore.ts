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
  const keyEvents = selectKeyEventSentences(input.content, input.codexEntries)
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
  )
}

function selectKeyEventSentences(content: string, codexEntries: CodexEntry[]) {
  const sentences = usefulSentences(content)
  if (sentences.length <= 3) {
    return sentences
  }

  const keywords = uniqueStrings(
    codexEntries.flatMap((entry) => [entry.name, ...entry.keywords]),
  )
  const selectedIndexes = new Set<number>([0])
  const ranked = sentences
    .map((sentence, index) => ({
      index,
      sentence,
      score: scoreSummarySentence(sentence, index, sentences.length, keywords),
    }))
    .toSorted((left, right) => right.score - left.score || left.index - right.index)

  for (const candidate of ranked) {
    if (selectedIndexes.size >= 5) break
    if (candidate.score <= 0 && selectedIndexes.size >= 3) break
    selectedIndexes.add(candidate.index)
  }

  return [...selectedIndexes]
    .toSorted((left, right) => left - right)
    .map((index) => sentences[index])
}

function scoreSummarySentence(
  sentence: string,
  index: number,
  total: number,
  keywords: string[],
) {
  let score = 0

  if (index === 0) score += 2
  if (index >= Math.max(0, total - 2)) score += 2
  if (/[“”"']/.test(sentence)) score += 1

  const keywordHits = keywords.filter((keyword) => sentence.includes(keyword))
  score += Math.min(keywordHits.length * 3, 9)

  if (/(终于|忽然|突然|原来|发现|知道|意识到|决定|选择|答应|承诺)/.test(sentence)) {
    score += 2
  }
  if (/(提醒|警告|要求|命令|不能|不要|必须|只会|绝不|如果|有一天)/.test(sentence)) {
    score += 2
  }
  if (/(身份|修为|境界|所在地|目标|风险|伤势|关系|背叛|死亡|失踪)/.test(sentence)) {
    score += 2
  }
  if (/(伏笔|线索|誓言|真相|钥|剑|令|印|封印|黑潮司|戒律堂)/.test(sentence)) {
    score += 1
  }

  return score
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
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
