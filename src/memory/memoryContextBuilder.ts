import type { NarrativeMemory } from '../types/domain'
import type { CodexEntry, ProjectChapter } from '../project/projectTypes'
import type { ChapterSummary } from './chapterSummaryStore'
import type { CharacterStateLog } from './characterStateLogStore'
import type { PlotThread } from './plotThreadStore'
import type { VolumeSummary } from './volumeSummaryStore'

export type BuildNarrativeMemoryInput = {
  chapter: ProjectChapter
  projectChapters?: ProjectChapter[]
  documentText: string
  codexEntries: CodexEntry[]
  chapterSummaries?: ChapterSummary[]
  volumeSummaries?: VolumeSummary[]
  characterStateLogs?: CharacterStateLog[]
  plotThreads?: PlotThread[]
  projectTitle: string
  budgetChars: number
}

export type MemoryBudgetAuditEntry = {
  layer: NarrativeMemory['layer']
  source: string
  priority: number
  originalChars: number
  selectedChars: number
  status: 'included' | 'truncated' | 'dropped'
}

export type MemoryLayerBudgetAuditSummary = {
  layer: NarrativeMemory['layer']
  targetBudgetShare: readonly [number, number]
  originalChars: number
  selectedChars: number
  entryCount: number
  includedCount: number
  truncatedCount: number
  droppedCount: number
}

export type NarrativeMemoryPlan = {
  memories: NarrativeMemory[]
  audit: {
    budgetChars: number
    usedChars: number
    droppedCount: number
    layerSummaries: MemoryLayerBudgetAuditSummary[]
    entries: MemoryBudgetAuditEntry[]
  }
}

type WeightedMemory = NarrativeMemory & {
  priority: number
}

export type MemoryLayerBudgetPolicy = {
  priority: number
  maxBoost: number
  targetBudgetShare: readonly [number, number]
  degradation: string
}

export const memoryBudgetLayerOrder = [
  'L2 风格',
  'L0 事实',
  'L3 意图',
  'L1 剧情',
] as const satisfies readonly NarrativeMemory['layer'][]

export const memoryBudgetPolicy = {
  safetyWindowRatio: 0.6,
  recentChapterCount: 3,
  dynamicRecallTopN: 3,
  detailedSummaryRecentCount: 5,
  distantSummaryMaxSignals: 4,
  promptOrder: ['用户指令', ...memoryBudgetLayerOrder],
  layers: {
    'L2 风格': {
      priority: 400,
      maxBoost: 0,
      targetBudgetShare: [0.4, 0.5],
      degradation: '保留当前草稿与近章原文，不主动摘要。',
    },
    'L0 事实': {
      priority: 300,
      maxBoost: 80,
      targetBudgetShare: [0.15, 0.2],
      degradation: '先减少无关卡片，再考虑移除直接命中的事实。',
    },
    'L3 意图': {
      priority: 200,
      maxBoost: 50,
      targetBudgetShare: [0.1, 0.15],
      degradation: '先减少召回条数，不挤占近期原文预算。',
    },
    'L1 剧情': {
      priority: 100,
      maxBoost: 50,
      targetBudgetShare: [0.15, 0.25],
      degradation: '优先压缩远期摘要，关键事件单独保留。',
    },
  },
} as const satisfies {
  safetyWindowRatio: number
  recentChapterCount: number
  dynamicRecallTopN: number
  detailedSummaryRecentCount: number
  distantSummaryMaxSignals: number
  promptOrder: readonly ('用户指令' | NarrativeMemory['layer'])[]
  layers: Record<NarrativeMemory['layer'], MemoryLayerBudgetPolicy>
}

export function getMemoryLayerPriority(
  layer: NarrativeMemory['layer'],
  boost = 0,
) {
  const policy = memoryBudgetPolicy.layers[layer]
  return policy.priority + Math.min(Math.max(boost, 0), policy.maxBoost)
}

export function buildNarrativeMemories(
  input: BuildNarrativeMemoryInput,
): NarrativeMemory[] {
  return buildNarrativeMemoryPlan(input).memories
}

export function buildNarrativeMemoryPlan(
  input: BuildNarrativeMemoryInput,
): NarrativeMemoryPlan {
  const keywordMatches = findKeywordMatches(input.codexEntries, input.documentText)
  const relevantSummaries = relevantChapterSummaries(
    input.chapter,
    input.chapterSummaries || [],
    input.projectChapters || [],
  )
  const relevantPlotThreads = relevantPlotThreadsForChapter(
    input.chapter,
    input.plotThreads || [],
    input.projectChapters || [],
  )
  const summaryMatches = findSummaryMatches(relevantSummaries, keywordMatches)
  const plotThreadMatches = findPlotThreadMatches(
    relevantPlotThreads,
    input.documentText,
    keywordMatches,
  )
  const weighted: WeightedMemory[] = [
    buildStyleMemory(input.chapter, input.documentText, input.projectChapters),
    ...buildFactMemories(input.codexEntries, keywordMatches),
    ...buildDynamicStateMemories(
      relevantCharacterStateLogs(
        input.chapter,
        input.characterStateLogs || [],
        input.projectChapters || [],
      ),
      input.documentText,
    ),
    buildIntentMemory(
      input.projectTitle,
      input.chapter,
      keywordMatches,
      summaryMatches,
      plotThreadMatches,
    ),
    ...buildRecallMemories(
      summaryMatches,
      plotThreadMatches,
      input.chapter,
      input.projectChapters || [],
    ),
    buildPlotMemory(
      input.chapter,
      input.documentText,
      relevantSummaries,
      relevantVolumeSummariesForChapter(
        input.chapter,
        input.volumeSummaries || [],
        input.projectChapters || [],
      ),
      relevantPlotThreads,
      input.projectChapters || [],
    ),
  ]

  return applyMemoryBudget(weighted, input.budgetChars)
}

function buildDynamicStateMemories(
  stateLogs: CharacterStateLog[],
  documentText: string,
): WeightedMemory[] {
  return stateLogs.map((log) => {
    const isMentioned = documentText.includes(log.characterName)
    const bodyParts = [
      `${log.characterName} 动态状态: ${log.field} = ${log.to}`,
      log.from ? `此前: ${log.from}` : undefined,
      `依据: ${trimEndingPunctuation(log.reason)}`,
      log.evidence ? `证据: ${trimEndingPunctuation(log.evidence)}` : undefined,
    ].filter(Boolean)

    return {
      layer: 'L0 事实',
      body: bodyParts.join('。'),
      source: `character_state_log:${log.id}`,
      priority: getMemoryLayerPriority('L0 事实', isMentioned ? 60 : 10),
    }
  })
}

function relevantCharacterStateLogs(
  chapter: ProjectChapter,
  stateLogs: CharacterStateLog[],
  projectChapters: ProjectChapter[],
): CharacterStateLog[] {
  if (stateLogs.length === 0) {
    return []
  }

  const chapterOrders = new Map(
    [chapter, ...projectChapters].map((projectChapter) => [
      projectChapter.id,
      projectChapter.order,
    ]),
  )
  const currentOrder = chapterOrders.get(chapter.id) ?? chapter.order

  if (!Number.isFinite(currentOrder)) {
    return latestStateLogsForChapter(stateLogs, chapter.id)
  }

  const latestByField = new Map<string, CharacterStateLog>()

  for (const log of stateLogs) {
    const logOrder = chapterOrders.get(log.chapterId)
    const shouldInclude =
      logOrder === undefined ? log.chapterId === chapter.id : logOrder <= currentOrder

    if (!shouldInclude) {
      continue
    }

    const key = `${log.characterName}:${log.field}`
    const existing = latestByField.get(key)
    if (!existing || compareStateLogOrder(existing, log, chapterOrders) <= 0) {
      latestByField.set(key, log)
    }
  }

  return [...latestByField.values()]
}

function latestStateLogsForChapter(
  stateLogs: CharacterStateLog[],
  chapterId: string,
) {
  const latestByField = new Map<string, CharacterStateLog>()

  for (const log of stateLogs) {
    if (log.chapterId !== chapterId) {
      continue
    }

    latestByField.set(`${log.characterName}:${log.field}`, log)
  }

  return [...latestByField.values()]
}

function compareStateLogOrder(
  left: CharacterStateLog,
  right: CharacterStateLog,
  chapterOrders: Map<string, number>,
) {
  const leftOrder = chapterOrders.get(left.chapterId) ?? Number.MAX_SAFE_INTEGER
  const rightOrder = chapterOrders.get(right.chapterId) ?? Number.MAX_SAFE_INTEGER

  return (
    leftOrder - rightOrder ||
    left.confirmedAt.localeCompare(right.confirmedAt) ||
    left.id.localeCompare(right.id)
  )
}

function trimEndingPunctuation(value: string) {
  return value.replace(/[。.!！?？]+$/, '')
}

function buildStyleMemory(
  chapter: ProjectChapter,
  documentText: string,
  projectChapters: ProjectChapter[] = [],
): WeightedMemory {
  const previousChapterCount = Math.max(0, memoryBudgetPolicy.recentChapterCount - 1)
  const recentChapters = recentPreviousChapters(
    projectChapters,
    chapter,
    previousChapterCount,
  )
  const recentProse = recentChapters.map(
    (recentChapter) =>
      `近期前文 ${recentChapter.title}:\n${fullUsefulText(recentChapter.content)}`,
  )

  return {
    layer: 'L2 风格',
    body: [
      `当前章节原文:\n${fullUsefulText(documentText)}`,
      ...recentProse,
    ]
      .filter(Boolean)
      .join('\n\n'),
    source: [chapter.path, ...recentChapters.map((recentChapter) => recentChapter.path)]
      .join(','),
    priority: getMemoryLayerPriority('L2 风格'),
  }
}

function buildFactMemories(
  codexEntries: CodexEntry[],
  keywordMatches: KeywordMatch[],
): WeightedMemory[] {
  const matchedIds = new Set(keywordMatches.map((match) => match.entry.id))
  const hasMatches = matchedIds.size > 0

  return codexEntries
    .filter((entry, index) => (hasMatches ? matchedIds.has(entry.id) : index < 3))
    .map((entry) => {
      const keywordHits =
        keywordMatches.find((match) => match.entry.id === entry.id)?.keywords
          .length || 0

      return {
        layer: 'L0 事实',
        body: formatCodexFactMemory(entry),
        source: entry.path,
        priority: getMemoryLayerPriority('L0 事实', keywordHits * 25),
      }
    })
}

function formatCodexFactMemory(entry: CodexEntry) {
  const stateSummary = formatCurrentState(entry.currentState)

  return [
    `${entry.name}: ${firstUsefulLines(entry.body, 3)}`,
    stateSummary ? `当前状态: ${stateSummary}` : undefined,
  ]
    .filter(Boolean)
    .join(' ')
}

function formatCurrentState(currentState: Record<string, string>) {
  return Object.entries(currentState)
    .map(([field, value]) => `${field}=${value}`)
    .join('；')
}

function buildIntentMemory(
  projectTitle: string,
  chapter: ProjectChapter,
  keywordMatches: KeywordMatch[],
  summaryMatches: SummaryMatch[],
  plotThreadMatches: PlotThreadMatch[],
): WeightedMemory {
  const matchedKeywords = uniqueStrings(
    keywordMatches.flatMap((match) => match.keywords),
  )
  const recallNote =
    matchedKeywords.length > 0
      ? `当前命中关键词: ${matchedKeywords.slice(0, 8).join('、')}。`
      : '当前未命中明确专名，优先保持本章意图和近期文风。'
  const codexAudit = keywordMatches
    .map((match) => `${match.entry.name}(${match.keywords.join('、')})`)
    .join('；')
  const summaryAudit = summaryMatches
    .map((match) => `${match.summary.chapterTitle}(${match.keywords.join('、')})`)
    .join('；')
  const plotThreadAudit = plotThreadMatches
    .map((match) => `${match.thread.title}(${match.keywords.join('、')})`)
    .join('；')
  const auditParts = [
    codexAudit ? `命中设定: ${codexAudit}` : undefined,
    summaryAudit ? `命中摘要: ${summaryAudit}` : undefined,
    plotThreadAudit ? `命中伏笔: ${plotThreadAudit}` : undefined,
  ].filter(Boolean)
  const recallAudit =
    auditParts.length > 0
      ? `召回审计: ${auditParts.join('；')}。`
      : '召回审计: 暂无明确设定或摘要命中。'

  return {
    layer: 'L3 意图',
    body: `项目《${projectTitle}》当前正在编辑 ${chapter.title}。输出必须尊重已有 Markdown 正文和设定卡。${recallNote}${recallAudit}`,
    source: 'meta/project.json',
    priority: getMemoryLayerPriority('L3 意图'),
  }
}

function buildRecallMemories(
  summaryMatches: SummaryMatch[],
  plotThreadMatches: PlotThreadMatch[],
  chapter: ProjectChapter,
  projectChapters: ProjectChapter[],
): WeightedMemory[] {
  const chapterOrders = new Map(
    [chapter, ...projectChapters].map((projectChapter) => [
      projectChapter.id,
      projectChapter.order,
    ]),
  )
  const currentOrder = chapterOrders.get(chapter.id) ?? chapter.order

  const summaryRecallMemories = summaryMatches
    .filter((match) => match.summary.chapterId !== chapter.id)
    .map((match) => {
      const summaryOrder = chapterOrders.get(match.summary.chapterId) ?? 0
      const recencyBoost =
        Number.isFinite(currentOrder) && Number.isFinite(summaryOrder)
          ? Math.max(0, 12 - Math.max(0, currentOrder - summaryOrder))
          : 0
      const boost = 12 + match.keywords.length * 8 + recencyBoost

      const memory: WeightedMemory = {
        layer: 'L3 意图',
        body: `关联召回: ${match.summary.chapterTitle}: ${match.summary.summary} 命中关键词: ${match.keywords.join('、')}`,
        source: `recall:chapter_summary:${match.summary.chapterId}`,
        priority: getMemoryLayerPriority('L3 意图', boost),
      }

      return memory
    })
  const plotThreadRecallMemories: WeightedMemory[] = plotThreadMatches.map((match) => {
    const plantedOrder = chapterOrders.get(match.thread.plantedChapterId) ?? 0
    const recencyBoost =
      Number.isFinite(currentOrder) && Number.isFinite(plantedOrder)
        ? Math.max(0, 12 - Math.max(0, currentOrder - plantedOrder))
        : 0
    const statusNote =
      match.thread.status === 'resolved' && match.thread.resolution
        ? `已回收: ${match.thread.resolution}`
        : '未回收'
    const boost =
      18 +
      match.keywords.length * 10 +
      recencyBoost +
      (match.thread.status === 'open' ? 8 : 0)

    return {
      layer: 'L3 意图',
      body: `伏笔召回: ${match.thread.title}: ${match.thread.content} 状态: ${statusNote} 埋设: ${match.thread.plantedChapterTitle} 命中关键词: ${match.keywords.join('、')}`,
      source: `recall:plot_thread:${match.thread.id}`,
      priority: getMemoryLayerPriority('L3 意图', boost),
    }
  })

  return [...summaryRecallMemories, ...plotThreadRecallMemories]
    .toSorted((left, right) => right.priority - left.priority)
    .slice(0, memoryBudgetPolicy.dynamicRecallTopN)
}

function buildPlotMemory(
  chapter: ProjectChapter,
  documentText: string,
  relevantSummaries: ChapterSummary[],
  relevantVolumeSummaries: VolumeSummary[],
  relevantPlotThreads: PlotThread[],
  projectChapters: ProjectChapter[],
): WeightedMemory {
  const openPlotThreads = relevantPlotThreads.filter(
    (thread) => thread.status === 'open',
  )
  const plotThreadBody =
    openPlotThreads.length > 0
      ? `未回收伏笔: ${openPlotThreads
          .map(
            (thread) =>
              `${thread.title}(${thread.plantedChapterTitle}): ${thread.content}`,
          )
          .join(' ')}`
      : ''

  if (relevantSummaries.length > 0) {
    const layeredSummary = formatLayeredSummaryBody(
      relevantSummaries,
      relevantVolumeSummaries,
      chaptersById([chapter, ...projectChapters]),
    )
    const summaryIds = relevantSummaries.map((summary) => summary.chapterId)
    const plotThreadIds = openPlotThreads.map((thread) => thread.id)

    return {
      layer: 'L1 剧情',
      body: [plotThreadBody, `全书脉络: ${layeredSummary.body}`]
        .filter(Boolean)
        .join(' '),
      source: [
        `chapter_summary:${summaryIds.join(',')}`,
        layeredSummary.volumeSummaryIds.length > 0
          ? `volume_summary:${layeredSummary.volumeSummaryIds.join(',')}`
          : undefined,
        plotThreadIds.length > 0
          ? `plot_thread:${plotThreadIds.join(',')}`
          : undefined,
      ]
        .filter(Boolean)
        .join(';'),
      priority: getMemoryLayerPriority('L1 剧情', 25 + openPlotThreads.length * 6),
    }
  }

  return {
    layer: 'L1 剧情',
    body: [`${chapter.title}: ${firstUsefulLines(documentText, 2)}`, plotThreadBody]
      .filter(Boolean)
      .join(' '),
    source: [
      chapter.path,
      openPlotThreads.length > 0
        ? `plot_thread:${openPlotThreads.map((thread) => thread.id).join(',')}`
        : undefined,
    ]
      .filter(Boolean)
      .join(';'),
    priority: getMemoryLayerPriority('L1 剧情', openPlotThreads.length * 6),
  }
}

function formatLayeredSummaryBody(
  summaries: ChapterSummary[],
  volumeSummaries: VolumeSummary[],
  projectChaptersById: Map<string, ProjectChapter>,
): { body: string; volumeSummaryIds: string[] } {
  const detailedCount = memoryBudgetPolicy.detailedSummaryRecentCount

  if (summaries.length <= detailedCount) {
    return {
      body: summaries
        .map((summary) => `${summary.chapterTitle}: ${summary.summary}`)
        .join(' '),
      volumeSummaryIds: [],
    }
  }

  const detailedSummaries = summaries.slice(-detailedCount)
  const distantSummaries = summaries.slice(0, -detailedCount)
  const distantLayer = formatDistantSummaryLayer(
    distantSummaries,
    volumeSummaries,
    projectChaptersById,
  )
  const detailedBody = detailedSummaries
    .map((summary) => `${summary.chapterTitle}: ${summary.summary}`)
    .join(' ')

  return {
    body: [
      distantLayer.body ? `远期压缩: ${distantLayer.body}` : undefined,
      `近期详细: ${detailedBody}`,
    ]
      .filter(Boolean)
      .join(' '),
    volumeSummaryIds: distantLayer.volumeSummaryIds,
  }
}

function chaptersById(chapters: ProjectChapter[]) {
  return new Map(chapters.map((chapter) => [chapter.id, chapter]))
}

function formatDistantSummaryLayer(
  summaries: ChapterSummary[],
  volumeSummaries: VolumeSummary[],
  projectChaptersById: Map<string, ProjectChapter>,
) {
  const groups = new Map<string, ChapterSummary[]>()

  for (const summary of summaries) {
    const groupKey = volumeKeyForSummary(
      summary,
      projectChaptersById.get(summary.chapterId),
    )
    groups.set(groupKey, [...(groups.get(groupKey) || []), summary])
  }

  const volumeSummariesById = new Map(
    volumeSummaries.map((summary) => [summary.volumeId, summary]),
  )
  const volumeSummaryIds: string[] = []
  const bodies = [...groups.entries()].map(([volumeId, group]) => {
    const volumeSummary = volumeSummariesById.get(volumeId)
    if (volumeSummary && volumeSummaryCoversGroup(volumeSummary, group)) {
      volumeSummaryIds.push(volumeSummary.volumeId)
      return `${volumeSummary.volumeTitle}: ${volumeSummary.summary}`
    }

    const first = group[0]
    const last = group.at(-1) || first
    const title =
      first.chapterId === last.chapterId
        ? first.chapterTitle
        : `${first.chapterTitle}~${last.chapterTitle}`
    const signals = pickCompressionSignals(
      group.map((summary) => compactSummarySignal(summary)),
    )

    return `${title}: ${signals.join('；')}`
  })

  return {
    body: bodies.join(' '),
    volumeSummaryIds,
  }
}

function volumeKeyForSummary(
  summary: ChapterSummary,
  chapter: ProjectChapter | undefined,
) {
  const volumeSegment = chapter?.path
    .split('/')
    .find((segment) => /^volume[-_]/i.test(segment))

  return volumeSegment || summary.chapterId
}

function volumeSummaryCoversGroup(
  volumeSummary: VolumeSummary,
  summaries: ChapterSummary[],
) {
  const summaryIds = new Set(summaries.map((summary) => summary.chapterId))

  return (
    summaryIds.size > 0 &&
    [...summaryIds].every((chapterId) =>
      volumeSummary.chapterIds.includes(chapterId),
    )
  )
}

function compactSummarySignal(summary: ChapterSummary) {
  const signal = summary.keyEvents.find(Boolean) || summary.summary
  return limitText(signal, 48)
}

function pickCompressionSignals(signals: string[]) {
  const maxSignals = memoryBudgetPolicy.distantSummaryMaxSignals
  const uniqueSignals = uniqueStrings(signals)

  if (uniqueSignals.length <= maxSignals) {
    return uniqueSignals
  }

  const headCount = Math.ceil(maxSignals / 2)
  const tailCount = Math.floor(maxSignals / 2)

  return uniqueStrings([
    ...uniqueSignals.slice(0, headCount),
    ...uniqueSignals.slice(-tailCount),
  ])
}

function limitText(value: string, maxChars: number) {
  const trimmed = value.trim()
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}…` : trimmed
}

function applyMemoryBudget(
  memories: WeightedMemory[],
  budgetChars: number,
): NarrativeMemoryPlan {
  const sorted = [...memories].sort((left, right) => right.priority - left.priority)
  const selected: NarrativeMemory[] = []
  const entries: MemoryBudgetAuditEntry[] = []
  let used = 0

  for (const memory of sorted) {
    const remaining = budgetChars - used
    if (remaining <= 0) {
      entries.push(auditEntry(memory, 0, 'dropped'))
      continue
    }

    const body =
      memory.body.length <= remaining
        ? memory.body
        : `${memory.body.slice(0, Math.max(0, remaining - 1))}…`

    if (!body.trim()) continue

    selected.push({
      layer: memory.layer,
      body,
      source: memory.source,
    })
    used += body.length
    entries.push(
      auditEntry(
        memory,
        body.length,
        body.length < memory.body.length ? 'truncated' : 'included',
      ),
    )
  }

  return {
    memories: selected.sort(
      (left, right) =>
        getMemoryLayerPriority(right.layer) - getMemoryLayerPriority(left.layer),
    ),
    audit: {
      budgetChars,
      usedChars: used,
      droppedCount: entries.filter((entry) => entry.status === 'dropped').length,
      layerSummaries: buildLayerBudgetSummaries(entries),
      entries,
    },
  }
}

function buildLayerBudgetSummaries(
  entries: MemoryBudgetAuditEntry[],
): MemoryLayerBudgetAuditSummary[] {
  return memoryBudgetLayerOrder.map((layer) => {
    const layerEntries = entries.filter((entry) => entry.layer === layer)

    return {
      layer,
      targetBudgetShare: memoryBudgetPolicy.layers[layer].targetBudgetShare,
      originalChars: sumBy(layerEntries, (entry) => entry.originalChars),
      selectedChars: sumBy(layerEntries, (entry) => entry.selectedChars),
      entryCount: layerEntries.length,
      includedCount: layerEntries.filter((entry) => entry.status === 'included')
        .length,
      truncatedCount: layerEntries.filter((entry) => entry.status === 'truncated')
        .length,
      droppedCount: layerEntries.filter((entry) => entry.status === 'dropped')
        .length,
    }
  })
}

function sumBy<T>(values: T[], readValue: (value: T) => number) {
  return values.reduce((total, value) => total + readValue(value), 0)
}

function auditEntry(
  memory: WeightedMemory,
  selectedChars: number,
  status: MemoryBudgetAuditEntry['status'],
): MemoryBudgetAuditEntry {
  return {
    layer: memory.layer,
    source: memory.source,
    priority: memory.priority,
    originalChars: memory.body.length,
    selectedChars,
    status,
  }
}

function firstUsefulLines(text: string, maxLines: number) {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .slice(0, maxLines)
      .join(' ') || '暂无内容。'
  )
}

function fullUsefulText(text: string) {
  return text.trim() || '暂无内容。'
}

type KeywordMatch = {
  entry: CodexEntry
  keywords: string[]
}

type SummaryMatch = {
  summary: ChapterSummary
  keywords: string[]
}

type PlotThreadMatch = {
  thread: PlotThread
  keywords: string[]
}

function findKeywordMatches(
  codexEntries: CodexEntry[],
  documentText: string,
): KeywordMatch[] {
  return codexEntries
    .map((entry) => ({
      entry,
      keywords: uniqueStrings([entry.name, ...entry.keywords]).filter((keyword) =>
        keyword ? documentText.includes(keyword) : false,
      ),
    }))
    .filter((match) => match.keywords.length > 0)
}

function findSummaryMatches(
  chapterSummaries: ChapterSummary[],
  keywordMatches: KeywordMatch[],
): SummaryMatch[] {
  const matchedKeywords = uniqueStrings(
    keywordMatches.flatMap((match) => match.keywords),
  )

  if (matchedKeywords.length === 0) return []

  return chapterSummaries
    .map((summary) => ({
      summary,
      keywords: matchedKeywords.filter((keyword) =>
        `${summary.chapterTitle}\n${summary.summary}`.includes(keyword),
      ),
    }))
    .filter((match) => match.keywords.length > 0)
}

function findPlotThreadMatches(
  plotThreads: PlotThread[],
  documentText: string,
  keywordMatches: KeywordMatch[],
): PlotThreadMatch[] {
  const candidateKeywords = uniqueStrings([
    ...keywordMatches.flatMap((match) => match.keywords),
    ...plotThreads.flatMap((thread) => [thread.title, ...thread.keywords]),
  ])

  if (candidateKeywords.length === 0) return []

  return plotThreads
    .map((thread) => {
      const threadText = [
        thread.title,
        thread.content,
        thread.evidence,
        thread.resolution,
        ...thread.keywords,
        ...(thread.relatedCharacters || []),
      ]
        .filter(Boolean)
        .join('\n')
      const keywords = candidateKeywords.filter(
        (keyword) =>
          documentText.includes(keyword) &&
          (thread.keywords.includes(keyword) || threadText.includes(keyword)),
      )

      return { thread, keywords: uniqueStrings(keywords) }
    })
    .filter((match) => match.keywords.length > 0)
}

function recentPreviousChapters(
  projectChapters: ProjectChapter[],
  chapter: ProjectChapter,
  count: number,
) {
  return projectChapters
    .filter((candidate) => candidate.id !== chapter.id && candidate.order < chapter.order)
    .toSorted((left, right) => right.order - left.order)
    .slice(0, count)
    .toReversed()
}

function relevantChapterSummaries(
  chapter: ProjectChapter,
  chapterSummaries: ChapterSummary[],
  projectChapters: ProjectChapter[],
) {
  if (chapterSummaries.length === 0) return []

  const chapterOrders = new Map(
    projectChapters.map((projectChapter) => [projectChapter.id, projectChapter.order]),
  )
  const currentOrder = chapterOrders.get(chapter.id) || chapter.order

  return chapterSummaries
    .filter((summary) => {
      const summaryOrder = chapterOrders.get(summary.chapterId)
      return summary.chapterId === chapter.id || (
        summaryOrder !== undefined && summaryOrder <= currentOrder
      )
    })
    .toSorted((left, right) => {
      const leftOrder = chapterOrders.get(left.chapterId) || Number.MAX_SAFE_INTEGER
      const rightOrder = chapterOrders.get(right.chapterId) || Number.MAX_SAFE_INTEGER
      return leftOrder - rightOrder || left.chapterId.localeCompare(right.chapterId)
    })
}

function relevantVolumeSummariesForChapter(
  chapter: ProjectChapter,
  volumeSummaries: VolumeSummary[],
  projectChapters: ProjectChapter[],
) {
  if (volumeSummaries.length === 0) return []

  const chapterOrders = new Map(
    [chapter, ...projectChapters].map((projectChapter) => [
      projectChapter.id,
      projectChapter.order,
    ]),
  )
  const currentOrder = chapterOrders.get(chapter.id) ?? chapter.order

  return volumeSummaries.filter((volumeSummary) =>
    volumeSummary.chapterIds.every((chapterId) => {
      const chapterOrder = chapterOrders.get(chapterId)
      return chapterOrder !== undefined && chapterOrder <= currentOrder
    }),
  )
}

function relevantPlotThreadsForChapter(
  chapter: ProjectChapter,
  plotThreads: PlotThread[],
  projectChapters: ProjectChapter[],
) {
  if (plotThreads.length === 0) return []

  const chapterOrders = new Map(
    [chapter, ...projectChapters].map((projectChapter) => [
      projectChapter.id,
      projectChapter.order,
    ]),
  )
  const currentOrder = chapterOrders.get(chapter.id) ?? chapter.order

  if (!Number.isFinite(currentOrder)) {
    return plotThreads.filter((thread) => thread.plantedChapterId === chapter.id)
  }

  return plotThreads.flatMap((thread) => {
    const plantedOrder = chapterOrders.get(thread.plantedChapterId)
    const resolvedOrder = thread.resolvedChapterId
      ? chapterOrders.get(thread.resolvedChapterId)
      : undefined
    const isPlanted =
      plantedOrder === undefined
        ? thread.plantedChapterId === chapter.id
        : plantedOrder <= currentOrder

    if (!isPlanted) {
      return []
    }

    if (
      thread.status === 'resolved' &&
      (resolvedOrder === undefined || resolvedOrder > currentOrder)
    ) {
      return [
        {
          ...thread,
          status: 'open' as const,
          resolvedChapterId: undefined,
          resolvedChapterTitle: undefined,
          resolution: undefined,
        },
      ]
    }

    return [thread]
  })
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
