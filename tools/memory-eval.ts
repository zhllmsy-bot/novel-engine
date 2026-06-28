#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import {
  buildNarrativeMemoryPlan,
  getMemoryLayerPriority,
  memoryBudgetLayerOrder,
  memoryBudgetPolicy,
} from '../src/memory/memoryContextBuilder.ts'
import {
  buildMemorySourceSummary,
  memorySourceFamilyOrder,
  memorySourceRefs,
  type MemorySourceFamily,
} from '../src/memory/memorySourceSummary.ts'
import type { NarrativeMemoryPlan } from '../src/memory/memoryContextBuilder.ts'
import type { MemorySourceFamilySummary } from '../src/memory/memorySourceSummary.ts'
import type { ChapterSummary } from '../src/memory/chapterSummaryStore.ts'
import type { CharacterStateLog } from '../src/memory/characterStateLogStore.ts'
import type { PlotThread } from '../src/memory/plotThreadStore.ts'
import type { VolumeSummary } from '../src/memory/volumeSummaryStore.ts'
import { loadProjectFromFiles } from '../src/project/projectFileLoader.ts'
import type { MarkdownFileSource } from '../src/project/projectFileLoader.ts'
import type { CodexEntry, ProjectChapter } from '../src/project/projectTypes.ts'
import type { MemoryLayer, NarrativeMemory } from '../src/types/domain.ts'

export type MemoryEvalExpectation = {
  id: string
  description: string
  layer?: MemoryLayer
  contains: string[]
  notContains?: string[]
  sourceContains?: string[]
  sourceFamilies?: MemorySourceFamily[]
}

export type MemoryEvalConfig = {
  chapterId?: string
  budgetChars?: number
  minimumGain?: number
  expectations: MemoryEvalExpectation[]
  errors: string[]
}

export type MemoryEvalCaseResult = MemoryEvalExpectation & {
  ok: boolean
  matchedLayers: MemoryLayer[]
  matchedSources: string[]
  missing: string[]
  forbidden: string[]
  missingSources: string[]
  missingSourceFamilies: MemorySourceFamily[]
  baselineOk?: boolean
  delta?: 'gained' | 'kept' | 'lost' | 'missed'
}

export type MemoryEvalPolicyCheckResult = {
  id: string
  description: string
  ok: boolean
  evidence: string
}

export type MemoryEvalComparison = {
  baselinePassed: number
  fourLayerPassed: number
  minimumGain: number
  gainedExpectationIds: string[]
  lostExpectationIds: string[]
}

export type MemoryEvalPhase0Gate = {
  ok: boolean
  expectationPassRate: number
  baselinePassRate: number
  fourLayerPassRate: number
  gain: number
  requiredGain: number
  policyFailed: number
  failedReasonIds: string[]
}

export type MemoryEvalReport = {
  rootPath: string
  ok: boolean
  title?: string
  chapterId?: string
  budgetChars: number
  stats: {
    memories: number
    expectations: number
    passed: number
    failed: number
    policyChecks: number
    policyPassed: number
    policyFailed: number
    usedChars: number
    droppedCount: number
    baselinePassed: number
    fourLayerPassed: number
  }
  cases: MemoryEvalCaseResult[]
  baselineCases: MemoryEvalCaseResult[]
  comparison: MemoryEvalComparison
  phase0: MemoryEvalPhase0Gate
  sourceSummary: MemorySourceFamilySummary[]
  policyChecks: MemoryEvalPolicyCheckResult[]
  errors: string[]
  plan?: NarrativeMemoryPlan
  baselinePlan?: NarrativeMemoryPlan
}

type CliOptions = {
  rootPath: string
  chapterId?: string
  budgetChars?: number
  json: boolean
  help: boolean
}

type RawMemoryEvalConfig = {
  $schema?: unknown
  chapter_id?: unknown
  budget_chars?: unknown
  minimum_gain?: unknown
  expectations?: unknown
}

const defaultExpectations: MemoryEvalExpectation[] = [
  {
    id: 'l2-current-prose',
    description: 'L2 should preserve recent prose for style continuity.',
    layer: 'L2 风格',
    contains: ['当前章节原文', '玄铁剑'],
  },
  {
    id: 'l0-codex-fact',
    description: 'L0 should recall matching codex facts by keyword.',
    layer: 'L0 事实',
    contains: ['李长老', '金丹期'],
  },
  {
    id: 'l3-recall-audit',
    description: 'L3 should expose keyword hits and recall audit text.',
    layer: 'L3 意图',
    contains: ['当前命中关键词', '命中设定'],
  },
  {
    id: 'l1-plot-thread',
    description: 'L1 should provide plot continuity for the active chapter.',
    layer: 'L1 剧情',
    contains: ['第001章 山门雨'],
  },
]

const memoryEvalConfigKeys = new Set([
  '$schema',
  'chapter_id',
  'budget_chars',
  'minimum_gain',
  'expectations',
])

const memoryEvalExpectationKeys = new Set([
  'id',
  'description',
  'layer',
  'contains',
  'not_contains',
  'source_contains',
  'source_families',
])
const memoryEvalIdPattern = /^[a-z0-9][a-z0-9_.-]*$/
const futureSummarySentinel = '__future_summary_sentinel__'
const futureVolumeSummarySentinel = '__future_volume_summary_sentinel__'
const futureStateSentinel = '__future_state_sentinel__'
const futurePlotResolutionSentinel = '__future_plot_resolution_sentinel__'
const unknownCurrentOrderCurrentStateSentinel =
  '__unknown_current_order_current_state_sentinel__'
const unknownCurrentOrderOtherStateSentinel =
  '__unknown_current_order_other_state_sentinel__'
const unknownCurrentOrderCurrentPlotSentinel =
  '__unknown_current_order_current_plot_sentinel__'
const unknownCurrentOrderOtherPlotSentinel =
  '__unknown_current_order_other_plot_sentinel__'

export async function evaluateNarrativeMemory(input: {
  rootPath?: string
  chapterId?: string
  budgetChars?: number
  minimumGain?: number
  expectations?: MemoryEvalExpectation[]
} = {}): Promise<MemoryEvalReport> {
  const rootPath = resolve(input.rootPath || 'examples/demo-novel')
  let budgetChars = input.budgetChars || 900
  const errors: string[] = []

  try {
    const rootStat = await stat(rootPath)
    if (!rootStat.isDirectory()) {
      errors.push(`project root is not a directory: ${rootPath}`)
    }
  } catch {
    errors.push(`project root does not exist: ${rootPath}`)
  }

  if (errors.length > 0) {
    return emptyReport({ rootPath, budgetChars, errors })
  }

  const config = await loadMemoryEvalConfig(rootPath)
  if (config?.errors.length) {
    errors.push(...config.errors)
  }
  budgetChars = input.budgetChars || config?.budgetChars || budgetChars

  let project

  try {
    project = loadProjectFromFiles({
      rootPath,
      manifestSource: await readFile(join(rootPath, 'meta', 'project.json'), 'utf8'),
      chapterFiles: await collectMarkdownFiles(join(rootPath, 'manuscript'), rootPath),
      codexFiles: await collectMarkdownFiles(join(rootPath, 'codex'), rootPath),
    })
  } catch (error) {
    errors.push(`project loader: ${String(error)}`)
    return emptyReport({ rootPath, budgetChars, errors })
  }

  const chapterId = input.chapterId || config?.chapterId
  const chapter = pickChapter(project.chapters, chapterId)
  if (!chapter) {
    errors.push(
      chapterId
        ? `chapter not found: ${chapterId}`
        : 'no chapter available for memory evaluation',
    )
    return emptyReport({
      rootPath,
      budgetChars,
      errors,
      title: project.title,
      chapterId,
    })
  }

  const chapterSummaries = buildEvaluationSummaries(project.chapters)
  const plan = buildNarrativeMemoryPlan({
    chapter,
    projectChapters: project.chapters,
    documentText: chapter.content,
    codexEntries: project.codexEntries,
    chapterSummaries,
    projectTitle: project.title,
    budgetChars,
  })
  const baselinePlan = buildRecentProseBaselinePlan({
    chapter,
    projectChapters: project.chapters,
    documentText: chapter.content,
    budgetChars,
  })
  const expectations =
    input.expectations || config?.expectations || defaultExpectations
  const baselineCases = expectations.map((expectation) =>
    evaluateExpectation(baselinePlan, expectation),
  )
  const cases = annotateCaseDeltas(
    expectations.map((expectation) => evaluateExpectation(plan, expectation)),
    baselineCases,
  )
  const minimumGain =
    input.minimumGain ??
    config?.minimumGain ??
    defaultMinimumGainForExpectations(expectations)
  const comparison = compareMemoryEvalCases(baselineCases, cases, minimumGain)
  const policyChecks = evaluateMemoryBudgetPolicy({
    normalPlan: plan,
    tightPlan: buildNarrativeMemoryPlan({
      chapter,
      projectChapters: project.chapters,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries,
      projectTitle: project.title,
      budgetChars: 60,
    }),
    futureSummaryProbePlan: buildFutureSummaryProbePlan({
      chapter,
      projectChapters: project.chapters,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries,
      projectTitle: project.title,
      budgetChars,
    }),
    futureVolumeSummaryProbePlan: buildFutureVolumeSummaryProbePlan({
      chapter,
      projectChapters: project.chapters,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries,
      projectTitle: project.title,
      budgetChars,
    }),
    futureStateProbePlan: buildFutureStateProbePlan({
      chapter,
      projectChapters: project.chapters,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries,
      projectTitle: project.title,
      budgetChars,
    }),
    futurePlotResolutionProbePlan: buildFuturePlotResolutionProbePlan({
      chapter,
      projectChapters: project.chapters,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries,
      projectTitle: project.title,
      budgetChars,
    }),
    unknownCurrentOrderProbePlan: buildUnknownCurrentOrderProbePlan({
      chapter,
      projectChapters: project.chapters,
      documentText: chapter.content,
      codexEntries: project.codexEntries,
      chapterSummaries,
      projectTitle: project.title,
      budgetChars,
    }),
    expectRecallItems: shouldExpectSummaryRecallItems({
      chapter,
      projectChapters: project.chapters,
      codexEntries: project.codexEntries,
      chapterSummaries,
    }),
    expectations,
    comparison,
    minimumGain,
  })
  const failed = cases.filter((result) => !result.ok).length
  const policyFailed = policyChecks.filter((result) => !result.ok).length
  const phase0 = buildPhase0Gate({
    cases,
    comparison,
    errors,
    policyChecks,
  })
  const sourceSummary = buildMemorySourceSummary(plan.memories)

  return {
    rootPath,
    ok:
      errors.length === 0 &&
      failed === 0 &&
      policyFailed === 0 &&
      phase0.ok,
    title: project.title,
    chapterId: chapter.id,
    budgetChars,
    stats: {
      memories: plan.memories.length,
      expectations: cases.length,
      passed: cases.length - failed,
      failed,
      policyChecks: policyChecks.length,
      policyPassed: policyChecks.length - policyFailed,
      policyFailed,
      usedChars: plan.audit.usedChars,
      droppedCount: plan.audit.droppedCount,
      baselinePassed: comparison.baselinePassed,
      fourLayerPassed: comparison.fourLayerPassed,
    },
    cases,
    baselineCases,
    comparison,
    phase0,
    sourceSummary,
    policyChecks,
    errors,
    plan,
    baselinePlan,
  }
}

export function formatMemoryEvalReport(report: MemoryEvalReport): string {
  const layerSummaryLines =
    report.plan?.audit.layerSummaries.map((summary) => {
      const target = `${Math.round(summary.targetBudgetShare[0] * 100)}-${Math.round(summary.targetBudgetShare[1] * 100)}%`

      return `Layer ${summary.layer}: ${summary.selectedChars}/${summary.originalChars} chars, target ${target}, ${summary.entryCount} entries, ${summary.truncatedCount} truncated, ${summary.droppedCount} dropped`
    }) || []
  const sourceSummary = formatMemorySourceSummaryLine(report.sourceSummary)
  const lines = [
    `Memory eval: ${report.ok ? 'OK' : 'FAILED'}`,
    `Root: ${report.rootPath}`,
    report.title ? `Title: ${report.title}` : undefined,
    report.chapterId ? `Chapter: ${report.chapterId}` : undefined,
    `Budget: ${report.stats.usedChars}/${report.budgetChars} chars, ${report.stats.droppedCount} dropped`,
    sourceSummary,
    ...layerSummaryLines,
    `Expectations: ${report.stats.passed}/${report.stats.expectations} passed`,
    `Baseline: ${report.comparison.baselinePassed}/${report.stats.expectations} passed`,
    `Four-layer gain: +${report.comparison.gainedExpectationIds.length} (${report.comparison.gainedExpectationIds.join(', ') || 'none'})`,
    `Phase 0 gate: ${report.phase0.ok ? 'PASS' : 'FAIL'} (${formatPercent(report.phase0.fourLayerPassRate)} four-layer vs ${formatPercent(report.phase0.baselinePassRate)} baseline, gain +${report.phase0.gain}/${report.phase0.requiredGain})${report.phase0.failedReasonIds.length > 0 ? ` reasons=${report.phase0.failedReasonIds.join(',')}` : ''}`,
    `Policy: ${report.stats.policyPassed}/${report.stats.policyChecks} passed`,
    ...report.cases.map((result) => formatCaseResult(result)),
    ...report.policyChecks.map((result) =>
      result.ok
        ? `OK policy:${result.id} - ${result.evidence}`
        : `FAIL policy:${result.id} - ${result.evidence}`,
    ),
    ...report.errors.map((error) => `ERROR ${error}`),
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n')
}

function buildRecentProseBaselinePlan(input: {
  chapter: ProjectChapter
  projectChapters: ProjectChapter[]
  documentText: string
  budgetChars: number
}): NarrativeMemoryPlan {
  const previousChapterCount = Math.max(
    0,
    memoryBudgetPolicy.recentChapterCount - 1,
  )
  const recentChapters = input.projectChapters
    .filter(
      (candidate) =>
        candidate.id !== input.chapter.id && candidate.order < input.chapter.order,
    )
    .toSorted((left, right) => right.order - left.order)
    .slice(0, previousChapterCount)
    .toReversed()
  const body = [
    `当前章节原文:\n${fullUsefulText(input.documentText)}`,
    ...recentChapters.map(
      (chapter) => `近期前文 ${chapter.title}:\n${fullUsefulText(chapter.content)}`,
    ),
  ]
    .filter(Boolean)
    .join('\n\n')
  const selectedBody =
    body.length <= input.budgetChars
      ? body
      : `${body.slice(0, Math.max(0, input.budgetChars - 1))}…`
  const source = [
    input.chapter.path,
    ...recentChapters.map((chapter) => chapter.path),
  ].join(',')
  const memories: NarrativeMemory[] = selectedBody.trim()
    ? [
        {
          layer: 'L2 风格',
          body: selectedBody,
          source,
        },
      ]
    : []

  return {
    memories,
    audit: {
      budgetChars: input.budgetChars,
      usedChars: selectedBody.length,
      droppedCount: 0,
      layerSummaries: memoryBudgetLayerOrder.map((layer) => ({
        layer,
        targetBudgetShare:
          layer === 'L2 风格' ? [1, 1] : [0, 0],
        originalChars: layer === 'L2 风格' ? body.length : 0,
        selectedChars: layer === 'L2 风格' ? selectedBody.length : 0,
        entryCount: layer === 'L2 风格' ? 1 : 0,
        includedCount:
          layer === 'L2 风格' && selectedBody.length === body.length ? 1 : 0,
        truncatedCount:
          layer === 'L2 风格' && selectedBody.length < body.length ? 1 : 0,
        droppedCount: 0,
      })),
      entries: [
        {
          layer: 'L2 风格',
          source,
          priority: getMemoryLayerPriority('L2 风格'),
          originalChars: body.length,
          selectedChars: selectedBody.length,
          status: selectedBody.length < body.length ? 'truncated' : 'included',
        },
      ],
    },
  }
}

function compareMemoryEvalCases(
  baselineCases: MemoryEvalCaseResult[],
  fourLayerCases: MemoryEvalCaseResult[],
  minimumGain: number,
): MemoryEvalComparison {
  const baselineById = new Map(baselineCases.map((result) => [result.id, result]))
  const gainedExpectationIds = fourLayerCases
    .filter((result) => result.ok && !baselineById.get(result.id)?.ok)
    .map((result) => result.id)
  const lostExpectationIds = fourLayerCases
    .filter((result) => !result.ok && baselineById.get(result.id)?.ok)
    .map((result) => result.id)

  return {
    baselinePassed: baselineCases.filter((result) => result.ok).length,
    fourLayerPassed: fourLayerCases.filter((result) => result.ok).length,
    minimumGain,
    gainedExpectationIds,
    lostExpectationIds,
  }
}

function buildPhase0Gate(input: {
  cases: MemoryEvalCaseResult[]
  comparison: MemoryEvalComparison
  errors: string[]
  policyChecks: MemoryEvalPolicyCheckResult[]
}): MemoryEvalPhase0Gate {
  const expectationCount = input.cases.length
  const policyFailed = input.policyChecks.filter((result) => !result.ok).length
  const failedExpectationIds = input.cases
    .filter((result) => !result.ok)
    .map((result) => `expectation:${result.id}`)
  const failedReasonIds = [
    ...failedExpectationIds,
    ...input.comparison.lostExpectationIds.map((id) => `lost:${id}`),
    ...input.policyChecks
      .filter((result) => !result.ok)
      .map((result) => `policy:${result.id}`),
  ]

  if (input.errors.length > 0) {
    failedReasonIds.push('config-or-project-error')
  }

  if (input.comparison.fourLayerPassed < input.comparison.baselinePassed) {
    failedReasonIds.push('worse-than-baseline')
  }

  if (input.comparison.gainedExpectationIds.length < input.comparison.minimumGain) {
    failedReasonIds.push('insufficient-gain')
  }

  return {
    ok: failedReasonIds.length === 0,
    expectationPassRate: ratio(input.comparison.fourLayerPassed, expectationCount),
    baselinePassRate: ratio(input.comparison.baselinePassed, expectationCount),
    fourLayerPassRate: ratio(input.comparison.fourLayerPassed, expectationCount),
    gain: input.comparison.gainedExpectationIds.length,
    requiredGain: input.comparison.minimumGain,
    policyFailed,
    failedReasonIds: uniqueStrings(failedReasonIds),
  }
}

function annotateCaseDeltas(
  cases: MemoryEvalCaseResult[],
  baselineCases: MemoryEvalCaseResult[],
): MemoryEvalCaseResult[] {
  const baselineById = new Map(baselineCases.map((result) => [result.id, result]))

  return cases.map((result) => {
    const baselineOk = Boolean(baselineById.get(result.id)?.ok)
    const delta = caseDelta(baselineOk, result.ok)

    return {
      ...result,
      baselineOk,
      delta,
    }
  })
}

function caseDelta(
  baselineOk: boolean,
  fourLayerOk: boolean,
): NonNullable<MemoryEvalCaseResult['delta']> {
  if (fourLayerOk && !baselineOk) return 'gained'
  if (fourLayerOk && baselineOk) return 'kept'
  if (!fourLayerOk && baselineOk) return 'lost'
  return 'missed'
}

function formatCaseResult(result: MemoryEvalCaseResult) {
  const label = {
    gained: 'GAIN',
    kept: 'KEEP',
    lost: 'LOSS',
    missed: 'MISS',
  }[result.delta || (result.ok ? 'kept' : 'missed')]
  const location = `${result.id} (${result.layer || 'any layer'})`
  const problems = [
    result.missing.length > 0 ? `missing ${result.missing.join(', ')}` : undefined,
    result.forbidden.length > 0
      ? `forbidden ${result.forbidden.join(', ')}`
      : undefined,
    result.missingSources.length > 0
      ? `missing sources ${result.missingSources.join(', ')}`
      : undefined,
    result.missingSourceFamilies.length > 0
      ? `missing source families ${result.missingSourceFamilies.join(', ')}`
      : undefined,
  ]
    .filter(Boolean)
    .join('; ')
  const sources =
    result.matchedSources.length > 0
      ? ` sources=${formatSourceList(result.matchedSources)}`
      : ''

  return result.ok
    ? `${label} ${location}${sources}`
    : `${label} ${location}: ${problems}${sources}`
}

function formatSourceList(sources: string[]) {
  const visibleSources = sources.slice(0, 3)
  const moreCount = Math.max(0, sources.length - visibleSources.length)

  return `${visibleSources.join(',')}${moreCount > 0 ? `,+${moreCount} more` : ''}`
}

function formatMemorySourceSummaryLine(summary: MemorySourceFamilySummary[]) {
  if (summary.length === 0) {
    return undefined
  }

  return `Sources: ${summary
    .map(
      (item) =>
        `${item.label}:${item.memoryCount}/${item.sourceCount} (${item.selectedChars} chars)`,
    )
    .join(' · ')}`
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}

function evaluateMemoryBudgetPolicy(input: {
  normalPlan: NarrativeMemoryPlan
  tightPlan: NarrativeMemoryPlan
  futureSummaryProbePlan: NarrativeMemoryPlan
  futureVolumeSummaryProbePlan: NarrativeMemoryPlan
  futureStateProbePlan: NarrativeMemoryPlan
  futurePlotResolutionProbePlan: NarrativeMemoryPlan
  unknownCurrentOrderProbePlan: NarrativeMemoryPlan
  expectRecallItems: boolean
  expectations: MemoryEvalExpectation[]
  comparison: MemoryEvalComparison
  minimumGain: number
}): MemoryEvalPolicyCheckResult[] {
  const normalLayers = input.normalPlan.memories.map((memory) => memory.layer)
  const normalPriorityOrder = normalLayers.every((layer, index) => {
    const previousLayer = normalLayers[index - 1]
    return (
      index === 0 ||
      getMemoryLayerPriority(previousLayer) >= getMemoryLayerPriority(layer)
    )
  })
  const tightL2Entry = input.tightPlan.audit.entries.find(
    (entry) => entry.layer === 'L2 风格',
  )
  const tightL1Entry = input.tightPlan.audit.entries.find(
    (entry) => entry.layer === 'L1 剧情',
  )
  const recallEntry = input.normalPlan.audit.entries.find((entry) =>
    entry.source.startsWith('recall:chapter_summary:'),
  )
  const futureSummaryLeak = input.futureSummaryProbePlan.memories.find((memory) =>
    `${memory.source}\n${memory.body}`.includes(futureSummarySentinel),
  )
  const futureVolumeSummaryLeak =
    input.futureVolumeSummaryProbePlan.memories.find((memory) =>
      `${memory.source}\n${memory.body}`.includes(futureVolumeSummarySentinel),
    )
  const futureStateLeak = input.futureStateProbePlan.memories.find((memory) =>
    `${memory.source}\n${memory.body}`.includes(futureStateSentinel),
  )
  const futurePlotResolutionLeak =
    input.futurePlotResolutionProbePlan.memories.find((memory) =>
      `${memory.source}\n${memory.body}`.includes(futurePlotResolutionSentinel),
    )
  const unknownCurrentOrderText = input.unknownCurrentOrderProbePlan.memories
    .map((memory) => `${memory.source}\n${memory.body}`)
    .join('\n')
  const unknownCurrentOrderIsCurrentOnly =
    unknownCurrentOrderText.includes(unknownCurrentOrderCurrentStateSentinel) &&
    unknownCurrentOrderText.includes(unknownCurrentOrderCurrentPlotSentinel) &&
    !unknownCurrentOrderText.includes(unknownCurrentOrderOtherStateSentinel) &&
    !unknownCurrentOrderText.includes(unknownCurrentOrderOtherPlotSentinel)
  const hasNonL2Expectations = input.expectations.some(
    (expectation) => expectation.layer !== 'L2 风格',
  )

  return [
    {
      id: 'four-layer-not-worse-than-baseline',
      description: 'Four-layer memory must not pass fewer recall expectations than recent-prose-only baseline.',
      ok: input.comparison.fourLayerPassed >= input.comparison.baselinePassed,
      evidence: `baseline=${input.comparison.baselinePassed}, fourLayer=${input.comparison.fourLayerPassed}, lost=${input.comparison.lostExpectationIds.join(',') || 'none'}`,
    },
    {
      id: 'four-layer-gains-non-l2-recall',
      description: 'When non-L2 expectations exist, four-layer memory should prove recall beyond the sliding window.',
      ok:
        !hasNonL2Expectations ||
        input.comparison.gainedExpectationIds.length >= input.minimumGain,
      evidence: hasNonL2Expectations
        ? `required=${input.minimumGain}, gained=${input.comparison.gainedExpectationIds.join(',') || 'none'}`
        : 'gained=not-applicable',
    },
    {
      id: 'declared-layer-order',
      description: 'The exported budget layer order keeps recent prose ahead of other layers.',
      ok: memoryBudgetLayerOrder.join('>') === 'L2 风格>L0 事实>L3 意图>L1 剧情',
      evidence: `order=${memoryBudgetLayerOrder.join(' > ')}`,
    },
    {
      id: 'selected-memory-order',
      description: 'Selected memories are emitted in descending layer priority.',
      ok: normalPriorityOrder,
      evidence: `selected=${normalLayers.join(' > ') || 'none'}`,
    },
    {
      id: 'tight-budget-keeps-l2',
      description: 'A very tight budget still spends its first characters on L2 recent prose.',
      ok:
        input.tightPlan.memories[0]?.layer === 'L2 风格' &&
        Boolean(tightL2Entry && tightL2Entry.selectedChars > 0),
      evidence: `first=${input.tightPlan.memories[0]?.layer || 'none'}, l2=${tightL2Entry?.status || 'missing'}`,
    },
    {
      id: 'tight-budget-drops-l1-before-l2',
      description: 'L1 plot summaries yield before L2 recent prose under severe pressure.',
      ok:
        Boolean(tightL2Entry && tightL2Entry.selectedChars > 0) &&
        tightL1Entry?.status === 'dropped',
      evidence: `l2=${tightL2Entry?.status || 'missing'}, l1=${tightL1Entry?.status || 'missing'}`,
    },
    {
      id: 'l3-recall-items-visible',
      description: 'L3 keyword recall emits concrete recall entries when earlier summaries match.',
      ok:
        !input.expectRecallItems ||
        Boolean(recallEntry && recallEntry.selectedChars > 0),
      evidence: input.expectRecallItems
        ? `recall=${recallEntry?.source || 'missing'}`
        : 'recall=not-applicable',
    },
    {
      id: 'future-summary-time-sliced',
      description: 'Unknown-order future chapter summaries must not leak into any selected memory.',
      ok: !futureSummaryLeak,
      evidence: futureSummaryLeak
        ? `leaked=${futureSummaryLeak.source}`
        : 'leaked=none',
    },
    {
      id: 'future-volume-summary-time-sliced',
      description: 'Volume summaries that cover future or unknown-order chapters must not leak into L1 compressed context.',
      ok: !futureVolumeSummaryLeak,
      evidence: futureVolumeSummaryLeak
        ? `leaked=${futureVolumeSummaryLeak.source}`
        : 'leaked=none',
    },
    {
      id: 'future-state-time-sliced',
      description: 'Future character state logs must not leak into earlier chapter memory.',
      ok: !futureStateLeak,
      evidence: futureStateLeak
        ? `leaked=${futureStateLeak.source}`
        : 'leaked=none',
    },
    {
      id: 'future-plot-resolution-time-sliced',
      description: 'Future or unknown-order plot-thread resolutions must be masked when evaluating earlier chapters.',
      ok: !futurePlotResolutionLeak,
      evidence: futurePlotResolutionLeak
        ? `leaked=${futurePlotResolutionLeak.source}`
        : 'leaked=none',
    },
    {
      id: 'unknown-current-order-current-only',
      description: 'When active chapter order is not comparable, state and plot recall must stay current-chapter-only.',
      ok: unknownCurrentOrderIsCurrentOnly,
      evidence: unknownCurrentOrderIsCurrentOnly
        ? 'current-only=yes'
        : 'current-only=no',
    },
  ]
}

function buildFutureSummaryProbePlan(input: {
  chapter: ProjectChapter
  projectChapters: ProjectChapter[]
  documentText: string
  codexEntries: CodexEntry[]
  chapterSummaries: ChapterSummary[]
  projectTitle: string
  budgetChars: number
}) {
  const triggerKeyword = firstRecallKeyword(input.codexEntries)
  const futureProbeSummary: ChapterSummary = {
    chapterId: `${input.chapter.id}-future-probe`,
    chapterTitle: 'Future Summary Probe',
    summary: `This future summary must stay hidden: ${triggerKeyword} ${futureSummarySentinel}.`,
    keyEvents: [futureSummarySentinel],
    charactersInvolved: [],
    sourceHash: 'future-summary-probe',
    isEdited: false,
    updatedAt: '2026-06-28T00:00:00.000Z',
  }

  return buildNarrativeMemoryPlan({
    chapter: input.chapter,
    projectChapters: input.projectChapters,
    documentText: triggerKeyword
      ? `${input.documentText}\n${triggerKeyword}`
      : input.documentText,
    codexEntries: input.codexEntries,
    chapterSummaries: [...input.chapterSummaries, futureProbeSummary],
    projectTitle: input.projectTitle,
    budgetChars: Math.max(input.budgetChars, 1_200),
  })
}

function buildFutureVolumeSummaryProbePlan(input: {
  chapter: ProjectChapter
  projectChapters: ProjectChapter[]
  documentText: string
  codexEntries: CodexEntry[]
  chapterSummaries: ChapterSummary[]
  projectTitle: string
  budgetChars: number
}) {
  const probeChapters = buildVolumeSummaryProbeChapters(input.chapter)
  const currentChapter = probeChapters.at(-1) || input.chapter
  const chapterSummaries = probeChapters.slice(0, -1).map((chapter, index) => ({
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    summary: `Probe chapter ${index + 1} summary.`,
    keyEvents: [`probe-event-${index + 1}`],
    charactersInvolved: [],
    sourceHash: `future-volume-probe:${chapter.id}`,
    isEdited: false,
    updatedAt: '2026-06-28T00:00:00.000Z',
  }))
  const futureChapter = {
    ...currentChapter,
    id: `${currentChapter.id}-future-volume-probe`,
    title: 'Future Volume Probe Chapter',
    path: 'manuscript/volume-999/future-volume-probe.md',
    order: currentChapter.order + 1_000,
    content: '',
  }
  const futureVolumeSummary: VolumeSummary = {
    volumeId: 'volume-999',
    volumeTitle: 'Future Volume Probe',
    summary: `This future volume summary must stay hidden: ${futureVolumeSummarySentinel}.`,
    keySignals: [futureVolumeSummarySentinel],
    chapterIds: [
      chapterSummaries[0]?.chapterId || currentChapter.id,
      chapterSummaries[1]?.chapterId || currentChapter.id,
      `${currentChapter.id}-unknown-volume-coverage`,
    ],
    sourceHash: 'future-volume-summary-probe',
    isEdited: false,
    updatedAt: '2026-06-28T00:00:00.000Z',
  }

  return buildNarrativeMemoryPlan({
    chapter: currentChapter,
    projectChapters: [...probeChapters, futureChapter],
    documentText: currentChapter.content || input.documentText,
    codexEntries: input.codexEntries,
    chapterSummaries,
    volumeSummaries: [futureVolumeSummary],
    projectTitle: input.projectTitle,
    budgetChars: Math.max(input.budgetChars, 2_400),
  })
}

function buildFutureStateProbePlan(input: {
  chapter: ProjectChapter
  projectChapters: ProjectChapter[]
  documentText: string
  codexEntries: CodexEntry[]
  chapterSummaries: ChapterSummary[]
  projectTitle: string
  budgetChars: number
}) {
  const futureChapter = futureProbeChapter(input.chapter)
  const stateLog: CharacterStateLog = {
    kind: 'character_state',
    id: 'future-state-probe',
    characterName: firstRecallKeyword(input.codexEntries) || 'Future Character',
    field: 'future-state-probe',
    from: 'hidden',
    to: futureStateSentinel,
    reason: futureStateSentinel,
    evidence: futureStateSentinel,
    confidence: 'high',
    chapterId: futureChapter.id,
    chapterTitle: futureChapter.title,
    sourceSkillId: 'memory-eval.future-state-probe',
    confirmedAt: '2026-06-28T00:00:00.000Z',
  }

  return buildNarrativeMemoryPlan({
    chapter: input.chapter,
    projectChapters: [...input.projectChapters, futureChapter],
    documentText: input.documentText,
    codexEntries: input.codexEntries,
    chapterSummaries: input.chapterSummaries,
    characterStateLogs: [stateLog],
    projectTitle: input.projectTitle,
    budgetChars: Math.max(input.budgetChars, 1_200),
  })
}

function buildFuturePlotResolutionProbePlan(input: {
  chapter: ProjectChapter
  projectChapters: ProjectChapter[]
  documentText: string
  codexEntries: CodexEntry[]
  chapterSummaries: ChapterSummary[]
  projectTitle: string
  budgetChars: number
}) {
  const triggerKeyword = firstRecallKeyword(input.codexEntries)
  const thread: PlotThread = {
    id: 'future-plot-resolution-probe',
    title: 'Future Plot Resolution Probe',
    content: `Probe thread mentions ${triggerKeyword || 'a keyword'} but hides the future answer.`,
    plantedChapterId: input.chapter.id,
    plantedChapterTitle: input.chapter.title,
    keywords: uniqueStrings([
      'Future Plot Resolution Probe',
      triggerKeyword,
    ]),
    status: 'resolved',
    resolvedChapterId: `${input.chapter.id}-unknown-plot-resolution`,
    resolvedChapterTitle: 'Unknown Plot Resolution Chapter',
    resolution: futurePlotResolutionSentinel,
    confirmed: true,
    sourceSkillId: 'memory-eval.future-plot-probe',
    confirmedAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
  }

  return buildNarrativeMemoryPlan({
    chapter: input.chapter,
    projectChapters: input.projectChapters,
    documentText: triggerKeyword
      ? `${input.documentText}\n${triggerKeyword}`
      : input.documentText,
    codexEntries: input.codexEntries,
    chapterSummaries: input.chapterSummaries,
    plotThreads: [thread],
    projectTitle: input.projectTitle,
    budgetChars: Math.max(input.budgetChars, 1_200),
  })
}

function buildUnknownCurrentOrderProbePlan(input: {
  chapter: ProjectChapter
  projectChapters: ProjectChapter[]
  documentText: string
  codexEntries: CodexEntry[]
  chapterSummaries: ChapterSummary[]
  projectTitle: string
  budgetChars: number
}) {
  const chapter = {
    ...input.chapter,
    order: Number.NaN,
    content: `${input.documentText}\n${unknownCurrentOrderCurrentPlotSentinel}`,
  }
  const otherChapterId = `${input.chapter.id}-unknown-order-other`

  return buildNarrativeMemoryPlan({
    chapter,
    projectChapters: input.projectChapters.map((projectChapter) =>
      projectChapter.id === input.chapter.id ? chapter : projectChapter,
    ),
    documentText: chapter.content,
    codexEntries: input.codexEntries,
    chapterSummaries: input.chapterSummaries,
    characterStateLogs: [
      {
        kind: 'character_state',
        id: 'unknown-current-order-current-state',
        characterName: firstRecallKeyword(input.codexEntries) || 'Current Character',
        field: 'unknown-current-order-current-state',
        to: unknownCurrentOrderCurrentStateSentinel,
        reason: unknownCurrentOrderCurrentStateSentinel,
        confidence: 'high',
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        sourceSkillId: 'memory-eval.unknown-current-order-probe',
        confirmedAt: '2026-06-28T00:00:00.000Z',
      },
      {
        kind: 'character_state',
        id: 'unknown-current-order-other-state',
        characterName: firstRecallKeyword(input.codexEntries) || 'Other Character',
        field: 'unknown-current-order-other-state',
        to: unknownCurrentOrderOtherStateSentinel,
        reason: unknownCurrentOrderOtherStateSentinel,
        confidence: 'high',
        chapterId: otherChapterId,
        chapterTitle: 'Unknown Current Order Other Chapter',
        sourceSkillId: 'memory-eval.unknown-current-order-probe',
        confirmedAt: '2026-06-28T00:00:00.000Z',
      },
    ],
    plotThreads: [
      {
        id: 'unknown-current-order-current-plot',
        title: 'Unknown Current Order Current Plot',
        content: unknownCurrentOrderCurrentPlotSentinel,
        plantedChapterId: chapter.id,
        plantedChapterTitle: chapter.title,
        keywords: [unknownCurrentOrderCurrentPlotSentinel],
        status: 'open',
        confirmed: true,
        sourceSkillId: 'memory-eval.unknown-current-order-probe',
        confirmedAt: '2026-06-28T00:00:00.000Z',
        updatedAt: '2026-06-28T00:00:00.000Z',
      },
      {
        id: 'unknown-current-order-other-plot',
        title: 'Unknown Current Order Other Plot',
        content: unknownCurrentOrderOtherPlotSentinel,
        plantedChapterId: otherChapterId,
        plantedChapterTitle: 'Unknown Current Order Other Chapter',
        keywords: [unknownCurrentOrderCurrentPlotSentinel],
        status: 'resolved',
        resolution: unknownCurrentOrderOtherPlotSentinel,
        confirmed: true,
        sourceSkillId: 'memory-eval.unknown-current-order-probe',
        confirmedAt: '2026-06-28T00:00:00.000Z',
        updatedAt: '2026-06-28T00:00:00.000Z',
      },
    ],
    projectTitle: input.projectTitle,
    budgetChars: Math.max(input.budgetChars, 1_600),
  })
}

function buildVolumeSummaryProbeChapters(chapter: ProjectChapter): ProjectChapter[] {
  const baseOrder = Number.isFinite(chapter.order) ? chapter.order : 1
  const currentOrder = Math.max(baseOrder, 8)

  return Array.from({ length: currentOrder }, (_, index) => {
    const order = index + 1
    const id = `future-volume-probe-chapter-${String(order).padStart(3, '0')}`

    return {
      ...chapter,
      id,
      title: `Future Volume Probe Chapter ${order}`,
      path: `manuscript/volume-999/${id}.md`,
      order,
      content: order === currentOrder ? chapter.content : `Probe chapter ${order}.`,
    }
  })
}

function futureProbeChapter(chapter: ProjectChapter): ProjectChapter {
  return {
    ...chapter,
    id: `${chapter.id}-future-probe`,
    title: 'Future Probe Chapter',
    path: 'manuscript/future-probe.md',
    order: chapter.order + 1_000,
    content: '',
  }
}

function firstRecallKeyword(
  codexEntries: Array<{ name: string; keywords: string[] }>,
) {
  for (const entry of codexEntries) {
    const keyword = [entry.name, ...entry.keywords].find((candidate) =>
      Boolean(candidate.trim()),
    )
    if (keyword) return keyword
  }

  return ''
}

function shouldExpectSummaryRecallItems(input: {
  chapter: ProjectChapter
  projectChapters: ProjectChapter[]
  codexEntries: Array<{ name: string; keywords: string[] }>
  chapterSummaries: ChapterSummary[]
}) {
  const chapterOrder = input.chapter.order
  const matchedKeywords = uniqueStrings(
    input.codexEntries
      .flatMap((entry) => [entry.name, ...entry.keywords])
      .filter((keyword) => (keyword ? input.chapter.content.includes(keyword) : false)),
  )

  if (matchedKeywords.length === 0) {
    return false
  }

  const ordersByChapterId = new Map(
    input.projectChapters.map((chapter) => [chapter.id, chapter.order]),
  )

  return input.chapterSummaries.some((summary) => {
    const summaryOrder = ordersByChapterId.get(summary.chapterId)
    const isEarlier =
      summary.chapterId !== input.chapter.id &&
      summaryOrder !== undefined &&
      summaryOrder < chapterOrder
    const summaryText = `${summary.chapterTitle}\n${summary.summary}`

    return (
      isEarlier &&
      matchedKeywords.some((keyword) => summaryText.includes(keyword))
    )
  })
}

function evaluateExpectation(
  plan: NarrativeMemoryPlan,
  expectation: MemoryEvalExpectation,
): MemoryEvalCaseResult {
  const candidateMemories = expectation.layer
    ? plan.memories.filter((memory) => memory.layer === expectation.layer)
    : plan.memories
  const matchedLayers = [
    ...new Set(
      candidateMemories
        .filter((memory) =>
          expectation.contains.some((expected) => memory.body.includes(expected)),
        )
        .map((memory) => memory.layer),
    ),
  ]
  const exactSourceMatches = candidateMemories.filter((memory) =>
    expectation.contains.every((expected) => memory.body.includes(expected)),
  )
  const partialSourceMatches = candidateMemories.filter((memory) =>
    expectation.contains.some((expected) => memory.body.includes(expected)),
  )
  const matchedSources = [
    ...new Set(
      (exactSourceMatches.length > 0 ? exactSourceMatches : partialSourceMatches).map(
        (memory) => memory.source,
      ),
    ),
  ]
  const combinedBody = candidateMemories.map((memory) => memory.body).join('\n')
  const missing = expectation.contains.filter(
    (expected) => !combinedBody.includes(expected),
  )
  const forbidden = (expectation.notContains || []).filter((expected) =>
    combinedBody.includes(expected),
  )
  const missingSources = (expectation.sourceContains || []).filter(
    (expected) =>
      !matchedSources.some((source) => source.includes(expected)),
  )
  const matchedSourceFamilies = new Set(
    matchedSources.flatMap((source) =>
      memorySourceRefs(source).map((ref) => ref.family),
    ),
  )
  const missingSourceFamilies = (expectation.sourceFamilies || []).filter(
    (family) => !matchedSourceFamilies.has(family),
  )

  return {
    ...expectation,
    ok:
      missing.length === 0 &&
      forbidden.length === 0 &&
      missingSources.length === 0 &&
      missingSourceFamilies.length === 0,
    matchedLayers,
    matchedSources,
    missing,
    forbidden,
    missingSources,
    missingSourceFamilies,
  }
}

export async function loadMemoryEvalConfig(
  rootPath: string,
): Promise<MemoryEvalConfig | undefined> {
  const configPath = join(rootPath, 'meta', 'memory-eval.json')

  if (!(await pathExists(configPath))) {
    return undefined
  }

  let rawConfig: RawMemoryEvalConfig
  const errors: string[] = []

  try {
    const parsed = JSON.parse(await readFile(configPath, 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        expectations: [],
        errors: ['meta/memory-eval.json must be an object.'],
      }
    }
    rawConfig = parsed as RawMemoryEvalConfig
  } catch (error) {
    return {
      expectations: [],
      errors: [`meta/memory-eval.json: ${String(error)}`],
    }
  }

  for (const key of Object.keys(rawConfig)) {
    if (!memoryEvalConfigKeys.has(key)) {
      errors.push(`meta/memory-eval.json unknown field: ${key}.`)
    }
  }

  const expectations: MemoryEvalExpectation[] = []
  if (!Array.isArray(rawConfig.expectations) || rawConfig.expectations.length === 0) {
    errors.push('meta/memory-eval.json expectations must be a non-empty array.')
  }

  if (Array.isArray(rawConfig.expectations)) {
    rawConfig.expectations.forEach((value, index) => {
      const parsed = parseExpectation(value, `meta/memory-eval.json expectations[${index}]`)
      expectations.push(...parsed.expectations)
      errors.push(...parsed.errors)
    })
  }

  const budgetChars = rawConfig.budget_chars
  if (budgetChars !== undefined && !isPositiveInteger(budgetChars)) {
    errors.push('meta/memory-eval.json budget_chars must be a positive integer.')
  }

  if (
    rawConfig.chapter_id !== undefined &&
    !isNonEmptyString(rawConfig.chapter_id)
  ) {
    errors.push('meta/memory-eval.json chapter_id must be a non-empty string.')
  }

  const minimumGain = rawConfig.minimum_gain
  if (minimumGain !== undefined && !isNonNegativeInteger(minimumGain)) {
    errors.push('meta/memory-eval.json minimum_gain must be a non-negative integer.')
  }

  if (
    rawConfig.$schema !== undefined &&
    !isNonEmptyString(rawConfig.$schema)
  ) {
    errors.push('meta/memory-eval.json $schema must be a non-empty string.')
  }

  return {
    chapterId:
      isNonEmptyString(rawConfig.chapter_id) ? rawConfig.chapter_id : undefined,
    budgetChars: isPositiveInteger(budgetChars) ? budgetChars : undefined,
    minimumGain: isNonNegativeInteger(minimumGain) ? minimumGain : undefined,
    expectations,
    errors,
  }
}

function defaultMinimumGainForExpectations(expectations: MemoryEvalExpectation[]) {
  return expectations.some((expectation) => expectation.layer !== 'L2 风格') ? 1 : 0
}

function parseExpectation(
  value: unknown,
  path: string,
): {
  expectations: MemoryEvalExpectation[]
  errors: string[]
} {
  const errors: string[] = []

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      expectations: [],
      errors: [
        `${path} must include string id, string description, and non-empty string contains array.`,
      ],
    }
  }

  const raw = value as {
    id?: unknown
    description?: unknown
    layer?: unknown
    contains?: unknown
    not_contains?: unknown
    source_contains?: unknown
    source_families?: unknown
  }

  for (const key of Object.keys(raw)) {
    if (!memoryEvalExpectationKeys.has(key)) {
      errors.push(`${path} unknown field: ${key}.`)
    }
  }

  if (!isNonEmptyString(raw.id) || !memoryEvalIdPattern.test(raw.id)) {
    errors.push(
      `${path} id must match /^[a-z0-9][a-z0-9_.-]*$/.`,
    )
  }

  if (!isNonEmptyString(raw.description)) {
    errors.push(`${path} description must be a non-empty string.`)
  }

  if (raw.layer !== undefined && !isMemoryLayer(raw.layer)) {
    errors.push(
      `${path} layer must be one of: L0 事实, L1 剧情, L2 风格, L3 意图.`,
    )
  }

  if (!Array.isArray(raw.contains) || raw.contains.length === 0) {
    errors.push(`${path} contains must be a non-empty string array.`)
  }

  const contains = Array.isArray(raw.contains)
    ? raw.contains.filter((item): item is string => isNonEmptyString(item))
    : []

  if (Array.isArray(raw.contains) && contains.length !== raw.contains.length) {
    errors.push(`${path} contains must only include non-empty strings.`)
  }

  const notContains = Array.isArray(raw.not_contains)
    ? raw.not_contains.filter((item): item is string => isNonEmptyString(item))
    : []

  if (
    raw.not_contains !== undefined &&
    (!Array.isArray(raw.not_contains) || raw.not_contains.length === 0)
  ) {
    errors.push(`${path} not_contains must be a non-empty string array when provided.`)
  }

  if (
    Array.isArray(raw.not_contains) &&
    notContains.length !== raw.not_contains.length
  ) {
    errors.push(`${path} not_contains must only include non-empty strings.`)
  }

  const sourceContains = Array.isArray(raw.source_contains)
    ? raw.source_contains.filter((item): item is string => isNonEmptyString(item))
    : []

  if (
    raw.source_contains !== undefined &&
    (!Array.isArray(raw.source_contains) || raw.source_contains.length === 0)
  ) {
    errors.push(`${path} source_contains must be a non-empty string array when provided.`)
  }

  if (
    Array.isArray(raw.source_contains) &&
    sourceContains.length !== raw.source_contains.length
  ) {
    errors.push(`${path} source_contains must only include non-empty strings.`)
  }

  const sourceFamilies = Array.isArray(raw.source_families)
    ? raw.source_families.filter((item): item is MemorySourceFamily =>
        isMemorySourceFamily(item),
      )
    : []

  if (
    raw.source_families !== undefined &&
    (!Array.isArray(raw.source_families) || raw.source_families.length === 0)
  ) {
    errors.push(`${path} source_families must be a non-empty memory source family array when provided.`)
  }

  if (
    Array.isArray(raw.source_families) &&
    sourceFamilies.length !== raw.source_families.length
  ) {
    errors.push(
      `${path} source_families must only include: ${memorySourceFamilyOrder.join(', ')}.`,
    )
  }

  if (
    Array.isArray(raw.source_families) &&
    new Set(raw.source_families).size !== raw.source_families.length
  ) {
    errors.push(`${path} source_families must not include duplicates.`)
  }

  if (errors.length > 0) {
    return {
      expectations: [],
      errors,
    }
  }

  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.description)) {
    return {
      expectations: [],
      errors,
    }
  }

  return {
    expectations: [
      {
        id: raw.id,
        description: raw.description,
        layer: isMemoryLayer(raw.layer) ? raw.layer : undefined,
        contains,
        notContains,
        sourceContains,
        sourceFamilies,
      },
    ],
    errors: [],
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isMemoryLayer(value: unknown): value is MemoryLayer {
  return (
    value === 'L0 事实' ||
    value === 'L1 剧情' ||
    value === 'L2 风格' ||
    value === 'L3 意图'
  )
}

function isMemorySourceFamily(value: unknown): value is MemorySourceFamily {
  return (
    typeof value === 'string' &&
    memorySourceFamilyOrder.includes(value as MemorySourceFamily)
  )
}

function buildEvaluationSummaries(chapters: ProjectChapter[]): ChapterSummary[] {
  return chapters.map((chapter) => ({
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    summary: firstUsefulLines(chapter.content, 2),
    keyEvents: [],
    charactersInvolved: [],
    sourceHash: `eval:${chapter.id}`,
    isEdited: false,
    updatedAt: '1970-01-01T00:00:00.000Z',
  }))
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

function pickChapter(chapters: ProjectChapter[], chapterId?: string) {
  return chapterId
    ? chapters.find((chapter) => chapter.id === chapterId)
    : chapters[0]
}

function emptyReport(input: {
  rootPath: string
  budgetChars: number
  errors: string[]
  title?: string
  chapterId?: string
}): MemoryEvalReport {
  return {
    rootPath: input.rootPath,
    ok: false,
    title: input.title,
    chapterId: input.chapterId,
    budgetChars: input.budgetChars,
    stats: {
      memories: 0,
      expectations: defaultExpectations.length,
      passed: 0,
      failed: defaultExpectations.length,
      policyChecks: 0,
      policyPassed: 0,
      policyFailed: 0,
      usedChars: 0,
      droppedCount: 0,
      baselinePassed: 0,
      fourLayerPassed: 0,
    },
    cases: [],
    baselineCases: [],
    comparison: {
      baselinePassed: 0,
      fourLayerPassed: 0,
      minimumGain: 0,
      gainedExpectationIds: [],
      lostExpectationIds: [],
    },
    phase0: {
      ok: false,
      expectationPassRate: 0,
      baselinePassRate: 0,
      fourLayerPassRate: 0,
      gain: 0,
      requiredGain: 0,
      policyFailed: 0,
      failedReasonIds: ['config-or-project-error'],
    },
    sourceSummary: [],
    policyChecks: [],
    errors: input.errors,
  }
}

async function collectMarkdownFiles(
  rootPath: string,
  projectRoot: string,
): Promise<MarkdownFileSource[]> {
  if (!(await pathExists(rootPath))) {
    return []
  }

  const files: MarkdownFileSource[] = []
  await collectMarkdownPath(rootPath, projectRoot, files)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

async function collectMarkdownPath(
  path: string,
  projectRoot: string,
  files: MarkdownFileSource[],
): Promise<void> {
  const pathStat = await stat(path)

  if (pathStat.isFile()) {
    if (path.endsWith('.md')) {
      files.push({
        path: normalizePath(relative(projectRoot, path)),
        filePath: path,
        content: await readFile(path, 'utf8'),
      })
    }
    return
  }

  if (!pathStat.isDirectory()) {
    return
  }

  const entries = await readdir(path, { withFileTypes: true })
  await Promise.all(
    entries.map((entry) =>
      collectMarkdownPath(join(path, entry.name), projectRoot, files),
    ),
  )
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/')
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function parseMemoryEvalArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    rootPath: 'examples/demo-novel',
    json: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--chapter') {
      options.chapterId = args[index + 1]
      index += 1
    } else if (arg === '--budget') {
      options.budgetChars = Number(args[index + 1])
      index += 1
    } else {
      options.rootPath = arg
    }
  }

  if (
    options.budgetChars !== undefined &&
    (!Number.isFinite(options.budgetChars) || options.budgetChars <= 0)
  ) {
    options.budgetChars = undefined
  }

  return options
}

function printHelp() {
  console.log(`Evaluate the Phase 0 narrative memory recall loop.

Usage:
  npm run memory:eval
  npm run memory:eval -- examples/demo-novel
  npm run memory:eval -- --chapter chapter-001 --budget 900
  npm run memory:eval -- --json /path/to/MyNovel

The evaluation is deterministic and does not call a model. It checks whether
the four-layer memory builder recalls expected layer content for a project.
`)
}

async function main() {
  const options = parseMemoryEvalArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await evaluateNarrativeMemory({
    rootPath: options.rootPath,
    chapterId: options.chapterId,
    budgetChars: options.budgetChars,
  })

  console.log(
    options.json ? JSON.stringify(report, null, 2) : formatMemoryEvalReport(report),
  )

  if (!report.ok) {
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
