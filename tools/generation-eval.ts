#!/usr/bin/env node
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { z } from 'zod'
import {
  buildNarrativeMemoryPlan,
  getMemoryLayerPriority,
  memoryBudgetLayerOrder,
  memoryBudgetPolicy,
  type NarrativeMemoryPlan,
} from '../src/memory/memoryContextBuilder.ts'
import {
  generateLocalChapterSummary,
  type ChapterSummary,
} from '../src/memory/chapterSummaryStore.ts'
import { loadProjectFromFiles } from '../src/project/projectFileLoader.ts'
import type { MarkdownFileSource } from '../src/project/projectFileLoader.ts'
import type { CodexEntry, ProjectChapter } from '../src/project/projectTypes.ts'
import type { NarrativeMemory } from '../src/types/domain.ts'

export type GenerationEvalArmId = 'baseline' | 'recent-fill' | 'four-layer'
export type GenerationEvalCriterionCategory =
  | 'callback'
  | 'setting'
  | 'future_leak'

export type GenerationEvalCriterion = {
  id: string
  description: string
  category: GenerationEvalCriterionCategory
  contains?: string[]
  containsAny?: string[]
  notContains?: string[]
}

export type GenerationEvalCriterionResult = GenerationEvalCriterion & {
  ok: boolean
  missing: string[]
  missingAny: string[]
  forbidden: string[]
}

export type GenerationEvalScore = {
  criteria: number
  passed: number
  failed: number
  callbackExpectations: number
  callbackHits: number
  settingExpectations: number
  settingViolations: number
  futureLeakChecks: number
  futureLeaks: number
  results: GenerationEvalCriterionResult[]
}

export type GenerationEvalArmReport = {
  id: GenerationEvalArmId
  label: string
  promptChars: number
  memoryCount: number
  memorySources: string[]
  promptPreview: string
  prompt?: string
  output?: string
  outputChars?: number
  error?: string
  score?: GenerationEvalScore
}

export type GenerationEvalRunArmReport = {
  id: GenerationEvalArmId
  output?: string
  outputChars?: number
  error?: string
  score?: GenerationEvalScore
}

export type GenerationEvalRunReport = {
  id: string
  chapterId?: string
  repeatIndex: number
  arms: GenerationEvalRunArmReport[]
}

export type GenerationEvalArmAggregate = {
  id: GenerationEvalArmId
  runs: number
  errors: number
  scoreMean: number
  scoreStdDev: number
  callbackMean: number
  callbackStdDev: number
  settingViolationMean: number
  settingViolationStdDev: number
  futureLeakTotal: number
}

export type GenerationEvalComparisonAggregate = {
  candidate: GenerationEvalArmId
  baseline: GenerationEvalArmId
  pairedRuns: number
  callbackWinRate: number
  callbackMeanDiff: number
  settingViolationMeanDiff: number
  futureLeakDiff: number
}

export type GenerationEvalAggregate = {
  arms: GenerationEvalArmAggregate[]
  comparisons: GenerationEvalComparisonAggregate[]
}

export type GenerationEvalGate = {
  status: 'not-run' | 'pass' | 'fail' | 'underpowered'
  ok: boolean
  failedReasonIds: string[]
}

export type GenerationEvalReport = {
  rootPath: string
  ok: boolean
  dryRun: boolean
  title?: string
  chapterId?: string
  budgetChars: number
  repeatCount: number
  provider: {
    kind: 'openai-compatible' | 'dry-run'
    baseUrl?: string
    model?: string
  }
  criteria: GenerationEvalCriterion[]
  arms: GenerationEvalArmReport[]
  runs: GenerationEvalRunReport[]
  aggregate: GenerationEvalAggregate
  archivePath?: string
  gate: GenerationEvalGate
  errors: string[]
}

export type GenerationEvalSuiteComparison = {
  candidate: GenerationEvalArmId
  baseline: GenerationEvalArmId
  projectCount: number
  pairedRuns: number
  callbackWinRateMean: number
  callbackMeanDiff: number
  settingViolationMeanDiff: number
  futureLeakDiff: number
}

export type GenerationEvalSuiteReport = {
  ok: boolean
  dryRun: boolean
  projectCount: number
  reports: GenerationEvalReport[]
  comparisons: GenerationEvalSuiteComparison[]
  archivePath?: string
  errors: string[]
}

type GenerationEvalConfig = {
  chapterId?: string
  budgetChars?: number
  instruction: string
  maxOutputChars: number
  criteria: GenerationEvalCriterion[]
}

type OpenAICompatibleGenerationConfig = {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxOutputChars: number
}

type CliOptions = {
  rootPath: string
  benchmarkProjects: string[]
  chapterId?: string
  budgetChars?: number
  dryRun: boolean
  json: boolean
  help: boolean
  showPrompts: boolean
  repeatCount?: number
  archiveDir?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  temperature?: number
  maxOutputChars?: number
}

const generationEvalIdPattern = /^[a-z0-9][a-z0-9_.-]*$/
const generationCriterionCategories = [
  'callback',
  'setting',
  'future_leak',
] as const
const defaultInstruction =
  '请接着当前章节续写沈泊回答简璃的一小段。只输出正文，不要解释，不要列提纲。'
const defaultMaxOutputChars = 600
const defaultBudgetChars = 1_200
const defaultRepeatCount = 3
const significantCallbackWinRate = 0.6
const minimumCrediblePairedRuns = 3

const generationCriterionSchema = z
  .object({
    id: z.string().regex(generationEvalIdPattern),
    description: z.string().min(1),
    category: z.enum(generationCriterionCategories),
    contains: z.array(z.string().min(1)).min(1).optional(),
    contains_any: z.array(z.string().min(1)).min(1).optional(),
    not_contains: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.contains?.length ||
          value.contains_any?.length ||
          value.not_contains?.length,
      ),
    'criterion must define contains, contains_any, or not_contains',
  )

const generationEvalConfigSchema = z
  .object({
    $schema: z.string().min(1).optional(),
    chapter_id: z.string().min(1).optional(),
    budget_chars: z.number().int().positive().optional(),
    instruction: z.string().min(1),
    max_output_chars: z.number().int().positive().optional(),
    criteria: z.array(generationCriterionSchema).min(1),
  })
  .strict()

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      }),
    )
    .min(1),
})

export async function evaluateGeneration(input: {
  rootPath?: string
  chapterId?: string
  budgetChars?: number
  dryRun?: boolean
  includePrompts?: boolean
  repeatCount?: number
  archiveDir?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  temperature?: number
  maxOutputChars?: number
} = {}): Promise<GenerationEvalReport> {
  const rootPath = resolve(input.rootPath || 'examples/long-memory-benchmark')
  const dryRun = input.dryRun ?? false
  const repeatCount = Math.max(
    1,
    Math.floor(input.repeatCount || defaultRepeatCount),
  )
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
    return emptyReport({ rootPath, dryRun, errors })
  }

  const config = await loadGenerationEvalConfig(rootPath)
  errors.push(...config.errors)

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
    return emptyReport({ rootPath, dryRun, errors })
  }

  const budgetChars =
    input.budgetChars || config.value?.budgetChars || defaultBudgetChars
  const chapterId = input.chapterId || config.value?.chapterId
  const chapter = pickChapter(project.chapters, chapterId)
  if (!chapter) {
    errors.push(
      chapterId
        ? `chapter not found: ${chapterId}`
        : 'no chapter available for generation evaluation',
    )
    return emptyReport({
      rootPath,
      dryRun,
      errors,
      title: project.title,
      chapterId,
      budgetChars,
    })
  }

  const evalConfig = config.value || defaultGenerationConfig()
  const maxOutputChars = input.maxOutputChars || evalConfig.maxOutputChars
  const chapterSummaries = buildEvaluationSummaries(
    project.chapters,
    project.codexEntries,
  )
  const fourLayerPlan = buildNarrativeMemoryPlan({
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
  const recentFillPlan = buildRecentProseFillPlan({
    chapter,
    projectChapters: project.chapters,
    documentText: chapter.content,
    budgetChars,
  })
  const providerConfig = resolveProviderConfig({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    model: input.model,
    temperature: input.temperature,
    maxOutputChars,
  })
  const arms = [
    buildArmReport({
      id: 'baseline',
      label: 'A baseline: recent prose only',
      plan: baselinePlan,
      projectTitle: project.title,
      chapter,
      instruction: evalConfig.instruction,
      includePrompt: input.includePrompts,
    }),
    buildArmReport({
      id: 'recent-fill',
      label: 'C recent-fill: same budget recent prose',
      plan: recentFillPlan,
      projectTitle: project.title,
      chapter,
      instruction: evalConfig.instruction,
      includePrompt: input.includePrompts,
    }),
    buildArmReport({
      id: 'four-layer',
      label: 'B four-layer memory',
      plan: fourLayerPlan,
      projectTitle: project.title,
      chapter,
      instruction: evalConfig.instruction,
      includePrompt: input.includePrompts,
    }),
  ]

  if (!dryRun && !providerConfig.apiKey) {
    errors.push(
      'missing API key: set NOVEL_ENGINE_EVAL_API_KEY or pass --api-key',
    )
  }

  const runs: GenerationEvalRunReport[] = []

  if (!dryRun && errors.length === 0) {
    for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
      const runArms: GenerationEvalRunArmReport[] = []

      for (const arm of arms) {
        const runArm: GenerationEvalRunArmReport = { id: arm.id }

        try {
          const output = await callOpenAICompatibleGeneration({
            config: providerConfig,
            prompt: arm.promptPreview,
          })
          runArm.output = output
          runArm.outputChars = output.length
          runArm.score = scoreGenerationOutput(output, evalConfig.criteria)
        } catch (error) {
          runArm.error = String(error)
        }

        runArms.push(runArm)
      }

      runs.push({
        id: `${chapter.id}-repeat-${repeatIndex + 1}`,
        chapterId: chapter.id,
        repeatIndex: repeatIndex + 1,
        arms: runArms,
      })
    }

    copyFirstRunToArms(arms, runs[0])
  }

  const aggregate = buildGenerationAggregate(arms, runs)
  const gate = buildGenerationGate({
    dryRun,
    aggregate,
  })
  const ok =
    errors.length === 0 &&
    arms.every((arm) => !arm.error) &&
    (dryRun || gate.ok)
  const archivePath =
    input.archiveDir && (dryRun || errors.length === 0)
      ? resolve(input.archiveDir)
      : undefined
  const report: GenerationEvalReport = {
    rootPath,
    ok,
    dryRun,
    title: project.title,
    chapterId: chapter.id,
    budgetChars,
    repeatCount,
    provider: dryRun
      ? { kind: 'dry-run' }
      : {
          kind: 'openai-compatible',
          baseUrl: providerConfig.baseUrl,
          model: providerConfig.model,
        },
    criteria: evalConfig.criteria,
    arms,
    runs,
    aggregate,
    archivePath,
    gate,
    errors,
  }

  if (archivePath) {
    await archiveGenerationEvalReport({
      archiveDir: archivePath,
      report,
    })
  }

  return report
}

export function scoreGenerationOutput(
  output: string,
  criteria: GenerationEvalCriterion[],
): GenerationEvalScore {
  const results = criteria.map((criterion) => {
    const missing = (criterion.contains || []).filter(
      (expected) => !output.includes(expected),
    )
    const hasAny =
      !criterion.containsAny?.length ||
      criterion.containsAny.some((expected) => output.includes(expected))
    const forbidden = (criterion.notContains || []).filter((expected) =>
      output.includes(expected),
    )

    return {
      ...criterion,
      ok: missing.length === 0 && hasAny && forbidden.length === 0,
      missing,
      missingAny: hasAny ? [] : criterion.containsAny || [],
      forbidden,
    }
  })
  const callbackResults = results.filter((result) => result.category === 'callback')
  const settingResults = results.filter((result) => result.category === 'setting')
  const futureLeakResults = results.filter(
    (result) => result.category === 'future_leak',
  )

  return {
    criteria: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    callbackExpectations: callbackResults.length,
    callbackHits: callbackResults.filter((result) => result.ok).length,
    settingExpectations: settingResults.length,
    settingViolations: settingResults.filter((result) => !result.ok).length,
    futureLeakChecks: futureLeakResults.length,
    futureLeaks: futureLeakResults.filter(
      (result) => result.forbidden.length > 0,
    ).length,
    results,
  }
}

export function formatGenerationEvalReport(report: GenerationEvalReport): string {
  const fourLayerVsBaseline = report.aggregate.comparisons.find(
    (comparison) =>
      comparison.candidate === 'four-layer' && comparison.baseline === 'baseline',
  )
  const fourLayerVsRecentFill = report.aggregate.comparisons.find(
    (comparison) =>
      comparison.candidate === 'four-layer' &&
      comparison.baseline === 'recent-fill',
  )
  const lines = [
    `Generation eval: ${report.dryRun ? 'DRY-RUN' : report.gate.status.toUpperCase()}`,
    `Root: ${report.rootPath}`,
    report.title ? `Title: ${report.title}` : undefined,
    report.chapterId ? `Chapter: ${report.chapterId}` : undefined,
    `Budget: ${report.budgetChars} chars`,
    `Repeats: ${report.repeatCount}`,
    `Provider: ${formatProvider(report)}`,
    `Criteria: ${formatCriteriaSummary(report.criteria)}`,
    fourLayerVsBaseline && fourLayerVsBaseline.pairedRuns > 0
      ? `Generation metrics: four-layer vs baseline callback win ${formatPercent(fourLayerVsBaseline.callbackWinRate)}, callback diff ${formatNumber(fourLayerVsBaseline.callbackMeanDiff)}, setting violation diff ${formatNumber(fourLayerVsBaseline.settingViolationMeanDiff)}, future leak diff ${fourLayerVsBaseline.futureLeakDiff}`
      : undefined,
    fourLayerVsRecentFill && fourLayerVsRecentFill.pairedRuns > 0
      ? `Generation control: four-layer vs recent-fill callback win ${formatPercent(fourLayerVsRecentFill.callbackWinRate)}, callback diff ${formatNumber(fourLayerVsRecentFill.callbackMeanDiff)}, setting violation diff ${formatNumber(fourLayerVsRecentFill.settingViolationMeanDiff)}, future leak diff ${fourLayerVsRecentFill.futureLeakDiff}`
      : undefined,
    `Gate: ${report.gate.status.toUpperCase()}${report.gate.failedReasonIds.length > 0 ? ` reasons=${report.gate.failedReasonIds.join(',')}` : ''}`,
    report.archivePath ? `Archive: ${report.archivePath}` : undefined,
    ...report.aggregate.arms.map((arm) => formatAggregateArm(arm)),
    ...report.arms.flatMap(formatArmReport),
    ...report.errors.map((error) => `ERROR ${error}`),
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n')
}

export async function evaluateGenerationSuite(input: {
  rootPaths: string[]
  chapterId?: string
  budgetChars?: number
  dryRun?: boolean
  includePrompts?: boolean
  repeatCount?: number
  archiveDir?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  temperature?: number
  maxOutputChars?: number
}): Promise<GenerationEvalSuiteReport> {
  const reports: GenerationEvalReport[] = []

  for (const rootPath of input.rootPaths) {
    const projectArchiveDir = input.archiveDir
      ? join(input.archiveDir, safeArchiveSegment(rootPath))
      : undefined
    reports.push(
      await evaluateGeneration({
        ...input,
        rootPath,
        archiveDir: projectArchiveDir,
      }),
    )
  }

  const comparisons = buildSuiteComparisons(reports)
  const errors = reports.flatMap((report) => report.errors)
  const suite: GenerationEvalSuiteReport = {
    ok:
      input.dryRun === true
        ? reports.length > 0 && reports.every((report) => report.ok)
        : reports.length > 0 &&
          reports.every((report) => report.ok) &&
          comparisons.every(
            (comparison) =>
              comparison.pairedRuns >= minimumCrediblePairedRuns &&
              comparison.callbackWinRateMean >= significantCallbackWinRate &&
              comparison.settingViolationMeanDiff <= 0 &&
              comparison.futureLeakDiff <= 0,
          ),
    dryRun: Boolean(input.dryRun),
    projectCount: reports.length,
    reports,
    comparisons,
    archivePath: input.archiveDir ? resolve(input.archiveDir) : undefined,
    errors,
  }

  if (input.archiveDir) {
    await archiveGenerationEvalSuite({
      archiveDir: input.archiveDir,
      suite,
    })
  }

  return suite
}

export function formatGenerationEvalSuiteReport(
  suite: GenerationEvalSuiteReport,
) {
  const lines = [
    `Generation eval suite: ${suite.dryRun ? 'DRY-RUN' : suite.ok ? 'PASS' : 'FAILED'}`,
    `Projects: ${suite.projectCount}`,
    suite.archivePath ? `Archive: ${suite.archivePath}` : undefined,
    ...suite.comparisons.map(
      (comparison) =>
        `Suite ${comparison.candidate} vs ${comparison.baseline}: projects ${comparison.projectCount}, paired runs ${comparison.pairedRuns}, callback win ${formatPercent(comparison.callbackWinRateMean)}, callback diff ${formatNumber(comparison.callbackMeanDiff)}, setting violation diff ${formatNumber(comparison.settingViolationMeanDiff)}, future leak diff ${comparison.futureLeakDiff}`,
    ),
    ...suite.reports.flatMap((report) => [
      `--- ${report.title || report.rootPath} ---`,
      formatGenerationEvalReport(report),
    ]),
    ...suite.errors.map((error) => `ERROR ${error}`),
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n')
}

function buildSuiteComparisons(
  reports: GenerationEvalReport[],
): GenerationEvalSuiteComparison[] {
  return [
    suiteComparison('four-layer', 'baseline', reports),
    suiteComparison('four-layer', 'recent-fill', reports),
  ]
}

function suiteComparison(
  candidate: GenerationEvalArmId,
  baseline: GenerationEvalArmId,
  reports: GenerationEvalReport[],
): GenerationEvalSuiteComparison {
  const comparisons = reports
    .map((report) =>
      report.aggregate.comparisons.find(
        (comparison) =>
          comparison.candidate === candidate && comparison.baseline === baseline,
      ),
    )
    .filter(
      (comparison): comparison is GenerationEvalComparisonAggregate =>
        Boolean(comparison),
    )

  return {
    candidate,
    baseline,
    projectCount: comparisons.length,
    pairedRuns: sum(comparisons.map((comparison) => comparison.pairedRuns)),
    callbackWinRateMean: mean(
      comparisons.map((comparison) => comparison.callbackWinRate),
    ),
    callbackMeanDiff: mean(
      comparisons.map((comparison) => comparison.callbackMeanDiff),
    ),
    settingViolationMeanDiff: mean(
      comparisons.map((comparison) => comparison.settingViolationMeanDiff),
    ),
    futureLeakDiff: sum(comparisons.map((comparison) => comparison.futureLeakDiff)),
  }
}

function buildArmReport(input: {
  id: GenerationEvalArmId
  label: string
  plan: NarrativeMemoryPlan
  projectTitle: string
  chapter: ProjectChapter
  instruction: string
  includePrompt?: boolean
}): GenerationEvalArmReport {
  const prompt = buildGenerationPrompt(input)

  return {
    id: input.id,
    label: input.label,
    promptChars: prompt.length,
    memoryCount: input.plan.memories.length,
    memorySources: input.plan.memories.map((memory) => memory.source),
    promptPreview: prompt,
    prompt: input.includePrompt ? prompt : undefined,
  }
}

function buildGenerationPrompt(input: {
  id: GenerationEvalArmId
  label: string
  plan: NarrativeMemoryPlan
  projectTitle: string
  chapter: ProjectChapter
  instruction: string
}) {
  const memories = input.plan.memories
    .map(
      (memory, index) =>
        `## ${index + 1}. ${memory.layer} (${memory.source})\n${memory.body}`,
    )
    .join('\n\n')

  return [
    `# 项目\n${input.projectTitle}`,
    `# 评测组\n${input.label}`,
    `# 当前章节\n${input.chapter.title} (${input.chapter.id})`,
    `# 任务\n${input.instruction}`,
    '# 写作要求',
    '- 只输出续写正文，不要解释评测过程。',
    '- 严格遵守下方上下文，不要凭空补未来剧情。',
    '- 自然承接当前场景，避免复述上下文清单。',
    '# 上下文',
    memories || '暂无上下文。',
  ].join('\n\n')
}

function buildGenerationGate(input: {
  dryRun: boolean
  aggregate: GenerationEvalAggregate
}): GenerationEvalGate {
  if (input.dryRun || input.aggregate.comparisons.length === 0) {
    return {
      status: 'not-run',
      ok: true,
      failedReasonIds: [],
    }
  }

  const failedReasonIds: string[] = []
  const fourLayer = input.aggregate.arms.find((arm) => arm.id === 'four-layer')
  const baselineComparison = input.aggregate.comparisons.find(
    (comparison) =>
      comparison.candidate === 'four-layer' && comparison.baseline === 'baseline',
  )
  const recentFillComparison = input.aggregate.comparisons.find(
    (comparison) =>
      comparison.candidate === 'four-layer' &&
      comparison.baseline === 'recent-fill',
  )

  if (
    !baselineComparison ||
    baselineComparison.callbackWinRate < significantCallbackWinRate
  ) {
    failedReasonIds.push('insufficient-callback-win-vs-baseline')
  }

  if (
    !baselineComparison ||
    baselineComparison.pairedRuns < minimumCrediblePairedRuns
  ) {
    failedReasonIds.push('underpowered-vs-baseline')
  }

  if (
    !recentFillComparison ||
    recentFillComparison.callbackWinRate < significantCallbackWinRate
  ) {
    failedReasonIds.push('insufficient-callback-win-vs-recent-fill')
  }

  if (
    !recentFillComparison ||
    recentFillComparison.pairedRuns < minimumCrediblePairedRuns
  ) {
    failedReasonIds.push('underpowered-vs-recent-fill')
  }

  if (baselineComparison && baselineComparison.settingViolationMeanDiff > 0) {
    failedReasonIds.push('more-setting-violations-vs-baseline')
  }

  if (recentFillComparison && recentFillComparison.settingViolationMeanDiff > 0) {
    failedReasonIds.push('more-setting-violations-vs-recent-fill')
  }

  if ((fourLayer?.futureLeakTotal || 0) > 0) {
    failedReasonIds.push('future-leak')
  }

  return {
    status:
      failedReasonIds.some((reason) => reason.startsWith('underpowered'))
        ? 'underpowered'
        : failedReasonIds.length === 0
          ? 'pass'
          : 'fail',
    ok: failedReasonIds.length === 0,
    failedReasonIds,
  }
}

async function callOpenAICompatibleGeneration(input: {
  config: OpenAICompatibleGenerationConfig
  prompt: string
}) {
  const baseUrl = normalizeBaseUrl(input.config.baseUrl)
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.config.model,
      temperature: input.config.temperature,
      max_tokens: Math.max(128, Math.ceil(input.config.maxOutputChars / 1.5)),
      messages: [
        {
          role: 'system',
          content: [
            '你是中文长篇小说续写助手。',
            '只输出正文，不要解释、不要列评分点、不要使用 Markdown 标题。',
            '严格遵守用户提供的上下文；没有依据的未来剧情不要写。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: input.prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI-compatible generation failed: ${response.status} ${body}`)
  }

  const payload = chatCompletionResponseSchema.parse(await response.json())
  return trimToChars(payload.choices[0].message.content.trim(), input.config.maxOutputChars)
}

async function loadGenerationEvalConfig(rootPath: string): Promise<{
  value?: GenerationEvalConfig
  errors: string[]
}> {
  const configPath = join(rootPath, 'meta', 'generation-eval.json')

  if (!(await pathExists(configPath))) {
    return {
      value: defaultGenerationConfig(),
      errors: [],
    }
  }

  try {
    const parsed = generationEvalConfigSchema.parse(
      JSON.parse(await readFile(configPath, 'utf8')),
    )

    return {
      value: {
        chapterId: parsed.chapter_id,
        budgetChars: parsed.budget_chars,
        instruction: parsed.instruction,
        maxOutputChars: parsed.max_output_chars || defaultMaxOutputChars,
        criteria: parsed.criteria.map((criterion) => ({
          id: criterion.id,
          description: criterion.description,
          category: criterion.category,
          contains: criterion.contains,
          containsAny: criterion.contains_any,
          notContains: criterion.not_contains,
        })),
      },
      errors: [],
    }
  } catch (error) {
    return {
      errors: [`meta/generation-eval.json: ${String(error)}`],
    }
  }
}

function defaultGenerationConfig(): GenerationEvalConfig {
  return {
    instruction: defaultInstruction,
    maxOutputChars: defaultMaxOutputChars,
    criteria: [],
  }
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
        targetBudgetShare: layer === 'L2 风格' ? [1, 1] : [0, 0],
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

function buildRecentProseFillPlan(input: {
  chapter: ProjectChapter
  projectChapters: ProjectChapter[]
  documentText: string
  budgetChars: number
}): NarrativeMemoryPlan {
  const recentChapters = input.projectChapters
    .filter(
      (candidate) =>
        candidate.id !== input.chapter.id && candidate.order < input.chapter.order,
    )
    .toSorted((left, right) => right.order - left.order)
  const body = [
    `当前章节原文:\n${fullUsefulText(input.documentText)}`,
    ...recentChapters.map(
      (chapter) => `更早正文 ${chapter.title}:\n${fullUsefulText(chapter.content)}`,
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
        targetBudgetShare: layer === 'L2 风格' ? [1, 1] : [0, 0],
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

function copyFirstRunToArms(
  arms: GenerationEvalArmReport[],
  firstRun?: GenerationEvalRunReport,
) {
  if (!firstRun) return

  for (const arm of arms) {
    const runArm = firstRun.arms.find((candidate) => candidate.id === arm.id)
    if (!runArm) continue

    arm.output = runArm.output
    arm.outputChars = runArm.outputChars
    arm.error = runArm.error
    arm.score = runArm.score
  }
}

function buildGenerationAggregate(
  arms: GenerationEvalArmReport[],
  runs: GenerationEvalRunReport[],
): GenerationEvalAggregate {
  return {
    arms: arms.map((arm) => aggregateArm(arm.id, runs)),
    comparisons: [
      compareArms('four-layer', 'baseline', runs),
      compareArms('four-layer', 'recent-fill', runs),
    ],
  }
}

function aggregateArm(
  armId: GenerationEvalArmId,
  runs: GenerationEvalRunReport[],
): GenerationEvalArmAggregate {
  const runArms = runs
    .map((run) => run.arms.find((arm) => arm.id === armId))
    .filter((arm): arm is GenerationEvalRunArmReport => Boolean(arm))
  const scored = runArms.filter((arm) => arm.score)
  const scores = scored.map((arm) => arm.score?.passed || 0)
  const callbackHits = scored.map((arm) => arm.score?.callbackHits || 0)
  const settingViolations = scored.map((arm) => arm.score?.settingViolations || 0)

  return {
    id: armId,
    runs: scored.length,
    errors: runArms.filter((arm) => arm.error).length,
    scoreMean: mean(scores),
    scoreStdDev: stdDev(scores),
    callbackMean: mean(callbackHits),
    callbackStdDev: stdDev(callbackHits),
    settingViolationMean: mean(settingViolations),
    settingViolationStdDev: stdDev(settingViolations),
    futureLeakTotal: scored.reduce(
      (total, arm) => total + (arm.score?.futureLeaks || 0),
      0,
    ),
  }
}

function compareArms(
  candidateId: GenerationEvalArmId,
  baselineId: GenerationEvalArmId,
  runs: GenerationEvalRunReport[],
): GenerationEvalComparisonAggregate {
  const pairs = runs
    .map((run) => ({
      candidate: run.arms.find((arm) => arm.id === candidateId),
      baseline: run.arms.find((arm) => arm.id === baselineId),
    }))
    .filter(
      (pair): pair is {
        candidate: GenerationEvalRunArmReport
        baseline: GenerationEvalRunArmReport
      } => Boolean(pair.candidate?.score && pair.baseline?.score),
    )
  const callbackDiffs = pairs.map(
    (pair) =>
      (pair.candidate.score?.callbackHits || 0) -
      (pair.baseline.score?.callbackHits || 0),
  )
  const settingViolationDiffs = pairs.map(
    (pair) =>
      (pair.candidate.score?.settingViolations || 0) -
      (pair.baseline.score?.settingViolations || 0),
  )
  const futureLeakDiffs = pairs.map(
    (pair) =>
      (pair.candidate.score?.futureLeaks || 0) -
      (pair.baseline.score?.futureLeaks || 0),
  )

  return {
    candidate: candidateId,
    baseline: baselineId,
    pairedRuns: pairs.length,
    callbackWinRate: ratio(
      callbackDiffs.filter((diff) => diff > 0).length,
      pairs.length,
    ),
    callbackMeanDiff: mean(callbackDiffs),
    settingViolationMeanDiff: mean(settingViolationDiffs),
    futureLeakDiff: sum(futureLeakDiffs),
  }
}

async function archiveGenerationEvalReport(input: {
  archiveDir: string
  report: GenerationEvalReport
}) {
  const archivePath = resolve(input.archiveDir)
  await mkdir(archivePath, { recursive: true })
  await writeFile(
    join(archivePath, 'generation-eval-report.json'),
    `${JSON.stringify(input.report, null, 2)}\n`,
  )
  await writeFile(
    join(archivePath, 'generation-eval-summary.md'),
    buildGenerationEvalSummary(input.report),
  )
  await writeFile(
    join(archivePath, 'human-review.csv'),
    buildHumanReviewCsv(input.report),
  )

  return archivePath
}

async function archiveGenerationEvalSuite(input: {
  archiveDir: string
  suite: GenerationEvalSuiteReport
}) {
  const archivePath = resolve(input.archiveDir)
  await mkdir(archivePath, { recursive: true })
  await writeFile(
    join(archivePath, 'generation-eval-suite.json'),
    `${JSON.stringify(input.suite, null, 2)}\n`,
  )
  await writeFile(
    join(archivePath, 'generation-eval-suite-summary.md'),
    buildGenerationEvalSuiteSummary(input.suite),
  )
  await writeFile(
    join(archivePath, 'human-review.csv'),
    buildSuiteHumanReviewCsv(input.suite),
  )

  return archivePath
}

function buildGenerationEvalSummary(report: GenerationEvalReport) {
  const comparisonLines = report.aggregate.comparisons.map(
    (comparison) =>
      `- ${comparison.candidate} vs ${comparison.baseline}: callback win rate ${formatPercent(comparison.callbackWinRate)}, callback mean diff ${formatNumber(comparison.callbackMeanDiff)}, setting violation diff ${formatNumber(comparison.settingViolationMeanDiff)}, future leak diff ${comparison.futureLeakDiff}`,
  )
  const armLines = report.aggregate.arms.map(
    (arm) =>
      `- ${arm.id}: runs ${arm.runs}, errors ${arm.errors}, score ${formatNumber(arm.scoreMean)}±${formatNumber(arm.scoreStdDev)}, callbacks ${formatNumber(arm.callbackMean)}±${formatNumber(arm.callbackStdDev)}, setting violations ${formatNumber(arm.settingViolationMean)}±${formatNumber(arm.settingViolationStdDev)}, future leaks ${arm.futureLeakTotal}`,
  )

  return `# Generation Eval Summary

- Status: ${report.gate.status}
- Project: ${report.title || report.rootPath}
- Chapter: ${report.chapterId || 'unknown'}
- Repeats: ${report.repeatCount}
- Provider: ${formatProvider(report)}
- Archive: ${report.archivePath || 'not archived'}

## Gate

- OK: ${String(report.gate.ok)}
- Reasons: ${report.gate.failedReasonIds.join(', ') || 'none'}

## Arms

${armLines.join('\n') || '- none'}

## Comparisons

${comparisonLines.join('\n') || '- none'}

## Human Review

Use \`human-review.csv\` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
`
}

function buildGenerationEvalSuiteSummary(suite: GenerationEvalSuiteReport) {
  const comparisonLines = suite.comparisons.map(
    (comparison) =>
      `- ${comparison.candidate} vs ${comparison.baseline}: projects ${comparison.projectCount}, paired runs ${comparison.pairedRuns}, callback win rate ${formatPercent(comparison.callbackWinRateMean)}, callback mean diff ${formatNumber(comparison.callbackMeanDiff)}, setting violation diff ${formatNumber(comparison.settingViolationMeanDiff)}, future leak diff ${comparison.futureLeakDiff}`,
  )
  const projectLines = suite.reports.map(
    (report) =>
      `- ${report.title || report.rootPath}: ${report.gate.status}, repeats ${report.repeatCount}, archive ${report.archivePath || 'none'}`,
  )

  return `# Generation Eval Suite Summary

- Status: ${suite.ok ? 'pass' : 'fail'}
- Dry run: ${String(suite.dryRun)}
- Projects: ${suite.projectCount}
- Archive: ${suite.archivePath || 'not archived'}

## Comparisons

${comparisonLines.join('\n') || '- none'}

## Projects

${projectLines.join('\n') || '- none'}

## Human Review

Use the top-level \`human-review.csv\` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
`
}

function buildHumanReviewCsv(report: GenerationEvalReport) {
  const rows = [
    [
      'run_id',
      'chapter_id',
      'repeat_index',
      'arm_id',
      'blind_label',
      'output',
      'callback_hits',
      'setting_violations',
      'future_leaks',
      'review_preference',
      'review_notes',
    ],
  ]

  for (const run of report.runs) {
    run.arms.forEach((arm, index) => {
      rows.push([
        run.id,
        run.chapterId || '',
        String(run.repeatIndex),
        arm.id,
        `sample-${index + 1}`,
        arm.output || '',
        String(arm.score?.callbackHits ?? ''),
        String(arm.score?.settingViolations ?? ''),
        String(arm.score?.futureLeaks ?? ''),
        '',
        '',
      ])
    })
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function buildSuiteHumanReviewCsv(suite: GenerationEvalSuiteReport) {
  const rows = [
    [
      'project',
      'run_id',
      'chapter_id',
      'repeat_index',
      'arm_id',
      'blind_label',
      'output',
      'callback_hits',
      'setting_violations',
      'future_leaks',
      'review_preference',
      'review_notes',
    ],
  ]

  for (const report of suite.reports) {
    for (const run of report.runs) {
      run.arms.forEach((arm, index) => {
        rows.push([
          report.title || report.rootPath,
          run.id,
          run.chapterId || '',
          String(run.repeatIndex),
          arm.id,
          `sample-${index + 1}`,
          arm.output || '',
          String(arm.score?.callbackHits ?? ''),
          String(arm.score?.settingViolations ?? ''),
          String(arm.score?.futureLeaks ?? ''),
          '',
          '',
        ])
      })
    }
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function mean(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0
}

function stdDev(values: number[]) {
  if (values.length <= 1) {
    return 0
  }

  const average = mean(values)
  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) /
    (values.length - 1)

  return Math.sqrt(variance)
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function buildEvaluationSummaries(
  chapters: ProjectChapter[],
  codexEntries: CodexEntry[],
): ChapterSummary[] {
  return chapters.map((chapter) => {
    const summary = generateLocalChapterSummary({
      chapter,
      content: chapter.content,
      codexEntries,
    })

    return {
      ...summary,
      sourceHash: `generation-eval:${summary.sourceHash}`,
      updatedAt: '1970-01-01T00:00:00.000Z',
    }
  })
}

function resolveProviderConfig(input: {
  baseUrl?: string
  apiKey?: string
  model?: string
  temperature?: number
  maxOutputChars: number
}): OpenAICompatibleGenerationConfig {
  return {
    baseUrl:
      input.baseUrl ||
      process.env.NOVEL_ENGINE_EVAL_BASE_URL ||
      'http://127.0.0.1:8000',
    apiKey:
      input.apiKey ||
      process.env.NOVEL_ENGINE_EVAL_API_KEY ||
      process.env.OPENAI_API_KEY ||
      '',
    model:
      input.model ||
      process.env.NOVEL_ENGINE_EVAL_MODEL ||
      'gpt-4.1-mini',
    temperature: input.temperature ?? Number(process.env.NOVEL_ENGINE_EVAL_TEMPERATURE || 0.4),
    maxOutputChars: input.maxOutputChars,
  }
}

function formatArmReport(arm: GenerationEvalArmReport) {
  const base = [
    `Arm ${arm.id}: prompt ${arm.promptChars} chars, memories ${arm.memoryCount}, sources=${formatSourceList(arm.memorySources)}`,
    arm.output
      ? `Output ${arm.id}: ${arm.outputChars || arm.output.length} chars`
      : undefined,
    arm.score
      ? `Score ${arm.id}: ${arm.score.passed}/${arm.score.criteria} criteria, callbacks ${arm.score.callbackHits}/${arm.score.callbackExpectations}, setting violations ${arm.score.settingViolations}, future leaks ${arm.score.futureLeaks}`
      : undefined,
    arm.error ? `ERROR arm:${arm.id} ${arm.error}` : undefined,
    arm.prompt ? `Prompt ${arm.id}:\n${arm.prompt}` : undefined,
    arm.output ? `Text ${arm.id}:\n${arm.output}` : undefined,
  ]

  return base.filter((line): line is string => Boolean(line))
}

function formatAggregateArm(arm: GenerationEvalArmAggregate) {
  if (arm.runs === 0 && arm.errors === 0) {
    return undefined
  }

  return `Aggregate ${arm.id}: runs ${arm.runs}, errors ${arm.errors}, score ${formatNumber(arm.scoreMean)}±${formatNumber(arm.scoreStdDev)}, callbacks ${formatNumber(arm.callbackMean)}±${formatNumber(arm.callbackStdDev)}, setting violations ${formatNumber(arm.settingViolationMean)}±${formatNumber(arm.settingViolationStdDev)}, future leaks ${arm.futureLeakTotal}`
}

function formatCriteriaSummary(criteria: GenerationEvalCriterion[]) {
  const callbacks = criteria.filter((item) => item.category === 'callback').length
  const settings = criteria.filter((item) => item.category === 'setting').length
  const leaks = criteria.filter((item) => item.category === 'future_leak').length

  return `${criteria.length} total (${callbacks} callback, ${settings} setting, ${leaks} future leak)`
}

function formatProvider(report: GenerationEvalReport) {
  if (report.provider.kind === 'dry-run') {
    return 'dry-run'
  }

  return `${report.provider.kind} model=${report.provider.model} baseUrl=${report.provider.baseUrl}`
}

function formatSourceList(sources: string[]) {
  if (sources.length === 0) return 'none'
  const visibleSources = sources.slice(0, 3)
  const moreCount = Math.max(0, sources.length - visibleSources.length)

  return `${visibleSources.join(',')}${moreCount > 0 ? `,+${moreCount} more` : ''}`
}

function pickChapter(chapters: ProjectChapter[], chapterId?: string) {
  return chapterId
    ? chapters.find((chapter) => chapter.id === chapterId)
    : chapters.at(-1)
}

function emptyReport(input: {
  rootPath: string
  dryRun: boolean
  errors: string[]
  title?: string
  chapterId?: string
  budgetChars?: number
}): GenerationEvalReport {
  return {
    rootPath: input.rootPath,
    ok: false,
    dryRun: input.dryRun,
    title: input.title,
    chapterId: input.chapterId,
    budgetChars: input.budgetChars || defaultBudgetChars,
    repeatCount: defaultRepeatCount,
    provider: input.dryRun ? { kind: 'dry-run' } : { kind: 'openai-compatible' },
    criteria: [],
    arms: [],
    runs: [],
    aggregate: {
      arms: [],
      comparisons: [],
    },
    gate: {
      status: 'not-run',
      ok: false,
      failedReasonIds: ['config-or-project-error'],
    },
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

function fullUsefulText(text: string) {
  return text.trim() || '暂无内容。'
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/')
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

function trimToChars(text: string, maxChars: number) {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…`
}

function safeArchiveSegment(path: string) {
  const leafName = basename(resolve(path)) || 'project'
  return leafName
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project'
}

export function parseGenerationEvalArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    rootPath: 'examples/long-memory-benchmark',
    benchmarkProjects: [],
    dryRun: false,
    json: false,
    help: false,
    showPrompts: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--show-prompts') {
      options.showPrompts = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--chapter') {
      options.chapterId = args[index + 1]
      index += 1
    } else if (arg === '--budget') {
      options.budgetChars = Number(args[index + 1])
      index += 1
    } else if (arg === '--base-url') {
      options.baseUrl = args[index + 1]
      index += 1
    } else if (arg === '--api-key') {
      options.apiKey = args[index + 1]
      index += 1
    } else if (arg === '--model') {
      options.model = args[index + 1]
      index += 1
    } else if (arg === '--temperature') {
      options.temperature = Number(args[index + 1])
      index += 1
    } else if (arg === '--max-output-chars') {
      options.maxOutputChars = Number(args[index + 1])
      index += 1
    } else if (arg === '--repeat') {
      options.repeatCount = Number(args[index + 1])
      index += 1
    } else if (arg === '--archive-dir') {
      options.archiveDir = args[index + 1]
      index += 1
    } else if (arg === '--benchmark-project') {
      options.benchmarkProjects.push(args[index + 1])
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

  if (
    options.temperature !== undefined &&
    (!Number.isFinite(options.temperature) || options.temperature < 0)
  ) {
    options.temperature = undefined
  }

  if (
    options.maxOutputChars !== undefined &&
    (!Number.isFinite(options.maxOutputChars) || options.maxOutputChars <= 0)
  ) {
    options.maxOutputChars = undefined
  }

  if (
    options.repeatCount !== undefined &&
    (!Number.isFinite(options.repeatCount) || options.repeatCount <= 0)
  ) {
    options.repeatCount = undefined
  }

  return options
}

function printHelp() {
  console.log(`Run a Phase 0 real-generation A/B/C eval.

Usage:
  npm run generation:eval -- --dry-run
  npm run generation:eval:long -- --dry-run --show-prompts
  npm run generation:eval:long -- --dry-run --archive-dir .novel/evals/dry-run
  npm run generation:eval -- --dry-run \\
    --benchmark-project examples/long-memory-benchmark \\
    --archive-dir .novel/evals/suite-dry-run
  NOVEL_ENGINE_EVAL_BASE_URL=http://127.0.0.1:8000 \\
  NOVEL_ENGINE_EVAL_API_KEY=... \\
  NOVEL_ENGINE_EVAL_MODEL=... \\
    npm run generation:eval:long -- --repeat 3 --archive-dir .novel/evals/run-001

The baseline arm receives recent prose only. The recent-fill control receives
the same budget filled with plain recent prose. The four-layer arm receives the
same memory plan used by the editor. Without --dry-run this command calls an
OpenAI-compatible /v1/chat/completions endpoint. Use --benchmark-project more
than once to run a suite across frozen benchmark projects.
`)
}

async function main() {
  const options = parseGenerationEvalArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report =
    options.benchmarkProjects.length > 0
      ? await evaluateGenerationSuite({
          rootPaths: options.benchmarkProjects,
          chapterId: options.chapterId,
          budgetChars: options.budgetChars,
          dryRun: options.dryRun,
          includePrompts: options.showPrompts,
          repeatCount: options.repeatCount,
          archiveDir: options.archiveDir,
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          model: options.model,
          temperature: options.temperature,
          maxOutputChars: options.maxOutputChars,
        })
      : await evaluateGeneration({
          rootPath: options.rootPath,
          chapterId: options.chapterId,
          budgetChars: options.budgetChars,
          dryRun: options.dryRun,
          includePrompts: options.showPrompts,
          repeatCount: options.repeatCount,
          archiveDir: options.archiveDir,
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          model: options.model,
          temperature: options.temperature,
          maxOutputChars: options.maxOutputChars,
        })

  console.log(
    options.json
      ? JSON.stringify(report, null, 2)
      : 'projectCount' in report
        ? formatGenerationEvalSuiteReport(report)
        : formatGenerationEvalReport(report),
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
