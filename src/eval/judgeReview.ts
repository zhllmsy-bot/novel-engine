import type { GenerationEvalCriterion } from './generationCriteria'
import type { CodexEntry } from '../project/projectTypes'

export type PairwiseReviewItem = {
  runId: string
  chapterId?: string
  repeatIndex: number
  leftSample: string
  rightSample: string
}

export function buildPairwiseJudgePrompt(input: PairwiseReviewItem) {
  return [
    '你是中文长篇小说续写评审。请盲评两个续写样本。',
    '判断维度: 是否自然承接、是否遵守设定、是否自然回收伏笔、是否避免未来剧透。',
    '不要根据长度偏好样本。若差异不明显，选择 tie。',
    '',
    `Run: ${input.runId}`,
    input.chapterId ? `Chapter: ${input.chapterId}` : undefined,
    `Repeat: ${input.repeatIndex}`,
    '',
    '样本 A:',
    input.leftSample,
    '',
    '样本 B:',
    input.rightSample,
    '',
    '请按 JSON 输出: {"choice":"A|B|tie","reason":"一句话理由"}',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

export type L0AuditPairwiseRow = {
  runId: string
  caseId?: string
  chapterId?: string
  repeatIndex: number
  pair: string
  order: 'candidate-right' | 'candidate-left'
  leftArm: string
  rightArm: string
  leftSample: string
  rightSample: string
}

export type L0AuditJudgeResult = {
  runId: string
  caseId?: string
  chapterId?: string
  repeatIndex: number
  pair: string
  order: 'candidate-right' | 'candidate-left'
  choice: string
  rawChoice?: string
  reason?: string
  error?: string
}

export type L0AuditCodexNeedle = {
  id: string
  name: string
  type: string
  path: string
  establishedChapterId: 'unknown'
  matchedTerms: string[]
  currentState: Record<string, string>
  excerpt: string
}

export type L0AuditNeedle = {
  criterionId: string
  criterionDescription: string
  category: GenerationEvalCriterion['category']
  terms: string[]
  status: 'mapped' | 'unmapped'
  reason?: string
  codexEntries: L0AuditCodexNeedle[]
}

export type L0AuditNeedleMappingCoverage = {
  totalCriteria: number
  mappedCriteria: number
  unmappedCriteria: number
  ratio: number
  unmappedCriterionIds: string[]
}

export type L0PinnedAuditPacket = {
  packetId: string
  project: string
  caseId?: string
  runId: string
  chapterId?: string
  repeatIndex: number
  pair: string
  order: 'candidate-right' | 'candidate-left'
  leftArm: string
  rightArm: string
  criteria: GenerationEvalCriterion[]
  leftSample: string
  rightSample: string
  judge?: {
    choice: string
    rawChoice?: string
    reason?: string
    error?: string
  }
  needles: L0AuditNeedle[]
  needleMappingCoverage: L0AuditNeedleMappingCoverage
}

export function buildAuditPinnedJudgePrompt(input: {
  packet: L0PinnedAuditPacket
  maxSampleChars?: number
  maxNeedleExcerptChars?: number
}) {
  const maxSampleChars = input.maxSampleChars || 2_000
  const maxNeedleExcerptChars = input.maxNeedleExcerptChars || 220
  const packet = input.packet
  const needleLines = packet.needles.flatMap((needle) => {
    if (needle.codexEntries.length === 0) {
      return [
        `- ${needle.criterionId} [${needle.status}]: ${needle.reason || 'no mapped L0 fact'}; terms=${needle.terms.join('|') || 'none'}`,
      ]
    }

    return needle.codexEntries.map((entry) =>
      [
        `- ${needle.criterionId} [${needle.status}]`,
        `codex=${entry.id}`,
        `name=${entry.name}`,
        `type=${entry.type}`,
        `path=${entry.path}`,
        `establishedChapter=${entry.establishedChapterId}`,
        `matched=${entry.matchedTerms.join('|')}`,
        `state=${JSON.stringify(entry.currentState)}`,
        `excerpt=${trimExcerpt(entry.excerpt, maxNeedleExcerptChars)}`,
      ].join('; '),
    )
  })
  const criteriaLines = packet.criteria.map(
    (criterion) =>
      `- ${criterion.id} [${criterion.category}]: ${criterion.description}`,
  )

  return [
    '你是中文长篇小说续写评审。请盲评两个续写样本。',
    '前置事实只允许依据下面的 L0 codex 钉屏事实，不要靠记忆补全。',
    '判断维度: 是否自然承接、是否遵守设定、是否自然回收伏笔、是否避免未来剧透。',
    '不要根据长度偏好样本。若差异不明显，选择 tie。',
    '',
    `Packet: ${packet.packetId}`,
    `Run: ${packet.runId}`,
    packet.chapterId ? `Chapter: ${packet.chapterId}` : undefined,
    `Repeat: ${packet.repeatIndex}`,
    `Pair: ${packet.pair}`,
    `Order: ${packet.order}`,
    '',
    'L0 codex 钉屏事实:',
    ...needleLines,
    '',
    '评审 criteria:',
    ...criteriaLines,
    '',
    '样本 A:',
    trimExcerpt(packet.leftSample, maxSampleChars),
    '',
    '样本 B:',
    trimExcerpt(packet.rightSample, maxSampleChars),
    '',
    '请只输出 JSON，格式如下:',
    '{"choice":"A|B|tie","claim":"短判断","evidence":["短证据"],"location":["A 段落1"],"needle_status":[{"needle_id":"criterion-id","status":"satisfied|violated|unclear","reason":"短理由"}],"reason":"一句话理由"}',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

export function buildL0PinnedAuditPackets(input: {
  project?: string
  criteria: GenerationEvalCriterion[]
  codexEntries?: CodexEntry[]
  rows: L0AuditPairwiseRow[]
  judgeResults?: L0AuditJudgeResult[]
}): L0PinnedAuditPacket[] {
  const needles = buildL0AuditNeedles(
    input.criteria,
    input.codexEntries || [],
  )
  const needleMappingCoverage = buildNeedleMappingCoverage(needles)

  return input.rows.map((row) => {
    const judge = input.judgeResults?.find(
      (result) =>
        result.runId === row.runId &&
        result.pair === row.pair &&
        result.order === row.order,
    )

    return {
      packetId: `${row.runId}:${row.pair}:${row.order}`,
      project: input.project || 'unknown',
      caseId: row.caseId,
      runId: row.runId,
      chapterId: row.chapterId,
      repeatIndex: row.repeatIndex,
      pair: row.pair,
      order: row.order,
      leftArm: row.leftArm,
      rightArm: row.rightArm,
      criteria: input.criteria,
      leftSample: row.leftSample,
      rightSample: row.rightSample,
      judge: judge
        ? {
            choice: judge.choice,
            rawChoice: judge.rawChoice,
            reason: judge.reason,
            error: judge.error,
          }
        : undefined,
      needles,
      needleMappingCoverage,
    }
  })
}

function buildL0AuditNeedles(
  criteria: GenerationEvalCriterion[],
  codexEntries: CodexEntry[],
): L0AuditNeedle[] {
  return criteria.map((criterion) => {
    const terms = criterionTerms(criterion)
    const codexMatches = terms.length
      ? codexEntries
          .map((entry) => buildCodexNeedle(entry, terms))
          .filter((entry): entry is L0AuditCodexNeedle => Boolean(entry))
      : []

    return {
      criterionId: criterion.id,
      criterionDescription: criterion.description,
      category: criterion.category,
      terms,
      status: codexMatches.length > 0 ? 'mapped' : 'unmapped',
      reason:
        codexMatches.length > 0
          ? undefined
          : terms.length > 0
            ? 'no L0 codex entry matched criterion terms'
            : 'criterion has no explicit terms to map',
      codexEntries: codexMatches,
    }
  })
}

function buildCodexNeedle(
  entry: CodexEntry,
  terms: string[],
): L0AuditCodexNeedle | undefined {
  const searchable = [
    entry.name,
    ...entry.keywords,
    entry.body,
    ...Object.values(entry.currentState || {}),
  ]
  const matchedTerms = terms.filter((term) =>
    searchable.some((field) => includesTerm(field, term)),
  )

  if (matchedTerms.length === 0) {
    return undefined
  }

  return {
    id: entry.id,
    name: entry.name,
    type: entry.type,
    path: entry.path,
    establishedChapterId: 'unknown',
    matchedTerms,
    currentState: entry.currentState || {},
    excerpt: codexExcerpt(entry, matchedTerms),
  }
}

function buildNeedleMappingCoverage(
  needles: L0AuditNeedle[],
): L0AuditNeedleMappingCoverage {
  const mappedCriteria = needles.filter((needle) => needle.status === 'mapped')
  const unmappedCriterionIds = needles
    .filter((needle) => needle.status === 'unmapped')
    .map((needle) => needle.criterionId)

  return {
    totalCriteria: needles.length,
    mappedCriteria: mappedCriteria.length,
    unmappedCriteria: unmappedCriterionIds.length,
    ratio: needles.length > 0 ? mappedCriteria.length / needles.length : 0,
    unmappedCriterionIds,
  }
}

function criterionTerms(criterion: GenerationEvalCriterion) {
  return uniqueStrings([
    ...(criterion.contains || []),
    ...(criterion.containsAny || []),
    ...(criterion.notContains || []),
  ])
}

function codexExcerpt(entry: CodexEntry, matchedTerms: string[]) {
  const currentState = Object.entries(entry.currentState || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  const source = [entry.body, currentState].filter(Boolean).join('\n')
  const matchedTerm = matchedTerms.find((term) => source.includes(term))

  if (!matchedTerm) {
    return trimExcerpt(source || entry.name, 220)
  }

  const index = source.indexOf(matchedTerm)
  const start = Math.max(0, index - 70)
  const end = Math.min(source.length, index + matchedTerm.length + 120)
  return `${start > 0 ? '...' : ''}${source.slice(start, end)}${end < source.length ? '...' : ''}`
}

function includesTerm(value: string | undefined, term: string) {
  if (!value) return false
  return value.toLocaleLowerCase().includes(term.toLocaleLowerCase())
}

function trimExcerpt(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, limit - 3)}...`
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  )
}
