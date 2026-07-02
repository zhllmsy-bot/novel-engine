#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import {
  runGenerationGuards,
  type EvalGuardResult,
} from '../src/eval/domainGuards.ts'
import {
  scoreGenerationOutput,
  type GenerationEvalCriterion,
  type GenerationEvalScore,
} from '../src/eval/generationCriteria.ts'
import { buildPairwiseJudgePrompt } from '../src/eval/judgeReview.ts'
import {
  computeGenerationStructureMetrics,
  type EvalStructureMetric,
} from '../src/eval/structureMetrics.ts'
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
  guards?: EvalGuardResult[]
  structureMetrics?: EvalStructureMetric[]
}

export type GenerationEvalRunArmReport = {
  id: GenerationEvalArmId
  output?: string
  outputChars?: number
  error?: string
  trace?: GenerationEvalTraceRecord
  score?: GenerationEvalScore
  guards?: EvalGuardResult[]
  structureMetrics?: EvalStructureMetric[]
}

export type GenerationEvalRunReport = {
  id: string
  caseId?: string
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

export type OpenAICompatibleWireApi = 'chat' | 'responses'

export type GenerationEvalFingerprint = {
  gitCommit: string
  datasetVersion: string
  datasetHash: string
  configHash: string
}

export type GenerationEvalJudgeChoice = 'four-layer' | 'baseline' | 'recent-fill' | 'tie' | 'invalid'

export type GenerationEvalJudgeResult = {
  runId: string
  caseId?: string
  chapterId?: string
  repeatIndex: number
  pair: string
  order: 'candidate-right' | 'candidate-left'
  leftArm: GenerationEvalArmId
  rightArm: GenerationEvalArmId
  choice: GenerationEvalJudgeChoice
  rawChoice: string
  reason: string
  error?: string
  trace?: GenerationEvalTraceRecord
}

export type GenerationEvalJudgeComparison = {
  baseline: 'baseline' | 'recent-fill'
  pairedReviews: number
  fourLayerWins: number
  baselineWins: number
  ties: number
  invalid: number
  fourLayerWinRate: number
}

export type GenerationEvalJudgeReport = {
  enabled: boolean
  provider?: {
    kind: 'openai-compatible'
    baseUrl: string
    model: string
    wireApi: OpenAICompatibleWireApi
  }
  results: GenerationEvalJudgeResult[]
  comparisons: GenerationEvalJudgeComparison[]
}

export type GenerationEvalUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type GenerationEvalTraceRecord = {
  kind: 'generation' | 'judge'
  wireApi: OpenAICompatibleWireApi
  model: string
  endpoint: string
  request: {
    systemPromptPreview: string
    promptPreview: string
    promptChars: number
    maxOutputChars: number
    temperature: number
    reasoningEffort?: string
    store?: boolean
  }
  response?: {
    responseId?: string
    statusCode: number
    object?: string
    model?: string
    finishedStatus?: string
    usage?: GenerationEvalUsage
    outputPreview?: string
  }
  error?: string
}

type GenerationEvalJudgeRow = {
  runId: string
  caseId?: string
  chapterId?: string
  repeatIndex: number
  pair: string
  order: 'candidate-right' | 'candidate-left'
  leftArm: GenerationEvalArmId
  rightArm: GenerationEvalArmId
  prompt: string
}

type GenerationEvalHumanPairwiseRow = Omit<GenerationEvalJudgeRow, 'prompt'> & {
  leftSample: string
  rightSample: string
}

export type GenerationEvalReport = {
  rootPath: string
  ok: boolean
  dryRun: boolean
  title?: string
  caseId?: string
  chapterId?: string
  budgetChars: number
  repeatCount: number
  provider: {
    kind: 'openai-compatible' | 'dry-run'
    baseUrl?: string
    model?: string
    wireApi?: OpenAICompatibleWireApi
    reasoningEffort?: string
  }
  fingerprint: GenerationEvalFingerprint
  criteria: GenerationEvalCriterion[]
  arms: GenerationEvalArmReport[]
  runs: GenerationEvalRunReport[]
  aggregate: GenerationEvalAggregate
  judge?: GenerationEvalJudgeReport
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

export type GenerationEvalSuiteReadiness = {
  ok: boolean
  projectCount: number
  loadedProjects: number
  promptReadyProjects: number
  errorCount: number
}

export type GenerationEvalSuiteReport = {
  ok: boolean
  dryRun: boolean
  projectCount: number
  reports: GenerationEvalReport[]
  comparisons: GenerationEvalSuiteComparison[]
  readiness: GenerationEvalSuiteReadiness
  archivePath?: string
  errors: string[]
}

type GenerationEvalCaseConfig = {
  caseId?: string
  chapterId?: string
  budgetChars?: number
  instruction: string
  maxOutputChars: number
  criteria: GenerationEvalCriterion[]
}

type GenerationEvalConfig = GenerationEvalCaseConfig & {
  cases: GenerationEvalCaseConfig[]
}

type OpenAICompatibleGenerationConfig = {
  baseUrl: string
  apiKey: string
  model: string
  wireApi: OpenAICompatibleWireApi
  temperature: number
  maxOutputChars: number
  reasoningEffort?: string
  store?: boolean
}

type OpenAICompatibleGenerationResult = {
  output: string
  trace: GenerationEvalTraceRecord
}

type CliOptions = {
  rootPath: string
  benchmarkProjects: string[]
  caseId?: string
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
  wireApi?: OpenAICompatibleWireApi
  judge: boolean
  judgeModel?: string
  judgeWireApi?: OpenAICompatibleWireApi
  temperature?: number
  reasoningEffort?: string
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
const requestTimeoutMs = 120_000
const retryableProviderStatusCodes = new Set([
  408, 409, 425, 429, 500, 502, 503, 504,
])
const significantCallbackWinRate = 0.6
const minimumCrediblePairedRuns = 3
const execFile = promisify(execFileCallback)

class ProviderHttpError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.name = 'ProviderHttpError'
  }
}

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

const generationEvalCaseSchema = z
  .object({
    id: z.string().regex(generationEvalIdPattern).optional(),
    chapter_id: z.string().min(1).optional(),
    budget_chars: z.number().int().positive().optional(),
    instruction: z.string().min(1).optional(),
    max_output_chars: z.number().int().positive().optional(),
    criteria: z.array(generationCriterionSchema).min(1).optional(),
  })
  .strict()

const generationEvalConfigSchema = z
  .object({
    $schema: z.string().min(1).optional(),
    chapter_id: z.string().min(1).optional(),
    budget_chars: z.number().int().positive().optional(),
    instruction: z.string().min(1).optional(),
    max_output_chars: z.number().int().positive().optional(),
    criteria: z.array(generationCriterionSchema).min(1).optional(),
    cases: z
      .array(generationEvalCaseSchema.extend({
        id: z.string().regex(generationEvalIdPattern),
      }))
      .min(1)
      .optional(),
  })
  .strict()
  .refine(
    (value) => Boolean((value.instruction && value.criteria?.length) || value.cases?.length),
    'generation eval config must define top-level instruction+criteria or cases[]',
  )

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([
            z.string(),
            z.array(
              z
                .object({
                  text: z.string().optional(),
                })
                .passthrough(),
            ),
          ]),
        }),
      }),
    )
    .min(1),
})

const responsesApiResponseSchema = z
  .object({
    id: z.string().optional(),
    object: z.string().optional(),
    status: z.string().optional(),
    output_text: z.string().optional(),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative().optional(),
        output_tokens: z.number().int().nonnegative().optional(),
        total_tokens: z.number().int().nonnegative().optional(),
      })
      .partial()
      .optional(),
    output: z
      .array(
        z
          .object({
            content: z
              .array(
                z
                  .object({
                    text: z.string().optional(),
                    output_text: z.string().optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough()

const judgeResponseSchema = z.object({
  choice: z.enum(['A', 'B', 'tie']).catch('tie'),
  reason: z.string().catch('No reason parsed.'),
})

const chatCompletionResponseWithUsageSchema = z.object({
  id: z.string().optional(),
  object: z.string().optional(),
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([
            z.string(),
            z.array(
              z
                .object({
                  text: z.string().optional(),
                })
                .passthrough(),
            ),
          ]),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
    })
    .partial()
    .optional(),
})

export async function evaluateGeneration(input: {
  rootPath?: string
  caseId?: string
  chapterId?: string
  budgetChars?: number
  dryRun?: boolean
  includePrompts?: boolean
  repeatCount?: number
  archiveDir?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  wireApi?: OpenAICompatibleWireApi
  judge?: boolean
  judgeModel?: string
  judgeWireApi?: OpenAICompatibleWireApi
  temperature?: number
  reasoningEffort?: string
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
  const generationConfig = config.value || defaultGenerationConfig()
  const evalConfig = selectGenerationEvalCase(generationConfig, input.caseId)
  if (!evalConfig) {
    errors.push(`generation eval case not found: ${input.caseId}`)
  }

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
    input.budgetChars || evalConfig?.budgetChars || defaultBudgetChars
  const chapterId = input.chapterId || evalConfig?.chapterId
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
      caseId: input.caseId,
      chapterId,
      budgetChars,
    })
  }

  if (!evalConfig) {
    return emptyReport({
      rootPath,
      dryRun,
      errors,
      title: project.title,
      caseId: input.caseId,
      chapterId,
      budgetChars,
    })
  }

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
    wireApi: input.wireApi,
    temperature: input.temperature,
    maxOutputChars,
    reasoningEffort: input.reasoningEffort,
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
  arms.forEach((arm) => {
    arm.structureMetrics = computeGenerationStructureMetrics({
      prompt: arm.promptPreview,
      criteria: evalConfig.criteria,
    })
  })

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
          const result = await callOpenAICompatibleGeneration({
            config: providerConfig,
            prompt: arm.promptPreview,
            kind: 'generation',
          })
          const output = result.output
          runArm.output = output
          runArm.outputChars = output.length
          runArm.trace = result.trace
          runArm.score = scoreGenerationOutput(output, evalConfig.criteria)
          runArm.guards = runGenerationGuards({
            output,
            currentChapter: chapter,
            chapters: project.chapters,
            codexEntries: project.codexEntries,
            criteria: evalConfig.criteria,
          })
          runArm.structureMetrics = computeGenerationStructureMetrics({
            prompt: arm.promptPreview,
            criteria: evalConfig.criteria,
          })
        } catch (error) {
          runArm.error = String(error)
        }

        runArms.push(runArm)
      }

      runs.push({
        id: `${evalConfig.caseId ? `${evalConfig.caseId}-` : ''}${chapter.id}-repeat-${repeatIndex + 1}`,
        caseId: evalConfig.caseId,
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
  const fingerprint = await buildGenerationFingerprint({
    rootPath,
    caseId: evalConfig.caseId,
    chapterId: chapter.id,
    instruction: evalConfig.instruction,
    budgetChars,
    repeatCount,
    maxOutputChars,
    provider: {
      model: dryRun ? undefined : providerConfig.model,
      wireApi: dryRun ? undefined : providerConfig.wireApi,
      reasoningEffort: dryRun ? undefined : providerConfig.reasoningEffort,
    },
    criteria: evalConfig.criteria,
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
    caseId: evalConfig.caseId,
    chapterId: chapter.id,
    budgetChars,
    repeatCount,
    provider: dryRun
      ? { kind: 'dry-run' }
      : {
          kind: 'openai-compatible',
          baseUrl: providerConfig.baseUrl,
          model: providerConfig.model,
          wireApi: providerConfig.wireApi,
          reasoningEffort: providerConfig.reasoningEffort,
        },
    fingerprint,
    criteria: evalConfig.criteria,
    arms,
    runs,
    aggregate,
    archivePath,
    gate,
    errors,
  }

  if (input.judge && !dryRun && errors.length === 0) {
    report.judge = await evaluateGenerationJudge({
      report,
      providerConfig: resolveProviderConfig({
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        model: input.judgeModel || process.env.NOVEL_ENGINE_EVAL_JUDGE_MODEL || input.model,
        wireApi:
          input.judgeWireApi ||
          normalizeWireApi(process.env.NOVEL_ENGINE_EVAL_JUDGE_WIRE_API) ||
          input.wireApi,
        temperature: 0,
        maxOutputChars: 2_000,
        reasoningEffort: input.reasoningEffort,
      }),
    })
  }

  if (archivePath) {
    await archiveGenerationEvalReport({
      archiveDir: archivePath,
      report,
    })
  }

  return report
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
    report.caseId ? `Case: ${report.caseId}` : undefined,
    report.chapterId ? `Chapter: ${report.chapterId}` : undefined,
    `Budget: ${report.budgetChars} chars`,
    `Repeats: ${report.repeatCount}`,
    `Provider: ${formatProvider(report)}`,
    `Fingerprint: git=${report.fingerprint.gitCommit} dataset=${report.fingerprint.datasetHash} config=${report.fingerprint.configHash}`,
    `Criteria: ${formatCriteriaSummary(report.criteria)}`,
    fourLayerVsBaseline && fourLayerVsBaseline.pairedRuns > 0
      ? `Generation metrics: four-layer vs baseline callback win ${formatPercent(fourLayerVsBaseline.callbackWinRate)}, callback diff ${formatNumber(fourLayerVsBaseline.callbackMeanDiff)}, setting violation diff ${formatNumber(fourLayerVsBaseline.settingViolationMeanDiff)}, future leak diff ${fourLayerVsBaseline.futureLeakDiff}`
      : undefined,
    fourLayerVsRecentFill && fourLayerVsRecentFill.pairedRuns > 0
      ? `Generation control: four-layer vs recent-fill callback win ${formatPercent(fourLayerVsRecentFill.callbackWinRate)}, callback diff ${formatNumber(fourLayerVsRecentFill.callbackMeanDiff)}, setting violation diff ${formatNumber(fourLayerVsRecentFill.settingViolationMeanDiff)}, future leak diff ${fourLayerVsRecentFill.futureLeakDiff}`
      : undefined,
    ...(report.judge?.comparisons || []).map(
      (comparison) =>
        `Judge: four-layer vs ${comparison.baseline} win ${formatPercent(comparison.fourLayerWinRate)} (${comparison.fourLayerWins}/${comparison.pairedReviews}, baseline wins ${comparison.baselineWins}, ties ${comparison.ties}, invalid ${comparison.invalid})`,
    ),
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
  caseId?: string
  chapterId?: string
  budgetChars?: number
  dryRun?: boolean
  includePrompts?: boolean
  repeatCount?: number
  archiveDir?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  wireApi?: OpenAICompatibleWireApi
  judge?: boolean
  judgeModel?: string
  judgeWireApi?: OpenAICompatibleWireApi
  temperature?: number
  reasoningEffort?: string
  maxOutputChars?: number
}): Promise<GenerationEvalSuiteReport> {
  const reports: GenerationEvalReport[] = []

  for (const rootPath of input.rootPaths) {
    const cases = input.caseId
      ? [{ caseId: input.caseId }]
      : await listGenerationEvalCases(rootPath)

    for (const generationCase of cases) {
      const projectArchiveDir = input.archiveDir
        ? join(input.archiveDir, safeArchiveSegmentWithCase(rootPath, generationCase.caseId))
        : undefined
      reports.push(
        await evaluateGeneration({
          ...input,
          rootPath,
          caseId: generationCase.caseId,
          archiveDir: projectArchiveDir,
        }),
      )
    }
  }

  const comparisons = buildSuiteComparisons(reports)
  const errors = reports.flatMap((report) => report.errors)
  const readiness = buildSuiteReadiness(reports, errors)
  const suite: GenerationEvalSuiteReport = {
    ok:
      input.dryRun === true
        ? readiness.ok
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
    readiness,
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
    `Readiness: ${suite.readiness.ok ? 'PASS' : 'FAIL'} loaded ${suite.readiness.loadedProjects}/${suite.readiness.projectCount}, prompt-ready ${suite.readiness.promptReadyProjects}/${suite.readiness.projectCount}, errors ${suite.readiness.errorCount}`,
    suite.dryRun
      ? 'Paired-run gate: deferred until non-dry-run generation'
      : undefined,
    suite.archivePath ? `Archive: ${suite.archivePath}` : undefined,
    ...suite.comparisons.map(
      (comparison) =>
        `Suite ${comparison.candidate} vs ${comparison.baseline}: projects ${comparison.projectCount}, paired runs ${comparison.pairedRuns}, callback win ${formatPercent(comparison.callbackWinRateMean)}, callback diff ${formatNumber(comparison.callbackMeanDiff)}, setting violation diff ${formatNumber(comparison.settingViolationMeanDiff)}, future leak diff ${comparison.futureLeakDiff}`,
    ),
    ...suite.reports.flatMap((report) => [
      `--- ${formatReportLabel(report)} ---`,
      formatGenerationEvalReport(report),
    ]),
    ...suite.errors.map((error) => `ERROR ${error}`),
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n')
}

function buildSuiteReadiness(
  reports: GenerationEvalReport[],
  errors: string[],
): GenerationEvalSuiteReadiness {
  const loadedProjects = reports.filter(
    (report) => report.errors.length === 0 && report.chapterId,
  ).length
  const promptReadyProjects = reports.filter(isPromptReadyReport).length

  return {
    ok:
      reports.length > 0 &&
      errors.length === 0 &&
      loadedProjects === reports.length &&
      promptReadyProjects === reports.length,
    projectCount: reports.length,
    loadedProjects,
    promptReadyProjects,
    errorCount: errors.length,
  }
}

function isPromptReadyReport(report: GenerationEvalReport) {
  const expectedArmIds: GenerationEvalArmId[] = [
    'baseline',
    'recent-fill',
    'four-layer',
  ]

  return expectedArmIds.every((id) => {
    const arm = report.arms.find((candidate) => candidate.id === id)
    return Boolean(arm && arm.promptChars > 0 && arm.promptPreview.trim())
  })
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
  systemPrompt?: string
  kind?: 'generation' | 'judge'
}): Promise<OpenAICompatibleGenerationResult> {
  const baseUrl = normalizeBaseUrl(input.config.baseUrl)
  const systemPrompt =
    input.systemPrompt ||
    [
      '你是中文长篇小说续写助手。',
      '只输出正文，不要解释、不要列评分点、不要使用 Markdown 标题。',
      '严格遵守用户提供的上下文；没有依据的未来剧情不要写。',
    ].join('\n')

  if (input.config.wireApi === 'responses') {
    return callOpenAICompatibleResponses({
      config: input.config,
      prompt: input.prompt,
      systemPrompt,
      kind: input.kind || 'generation',
    })
  }

  const requestBody = {
    model: input.config.model,
    temperature: input.config.temperature,
    max_tokens: Math.max(128, Math.ceil(input.config.maxOutputChars / 1.5)),
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: input.prompt,
      },
    ],
  }

  const response = await withProviderRetry(() =>
    fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: {
        Authorization: `Bearer ${input.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }),
  )

  if (!response.ok) {
    const body = await response.text()
    throw new ProviderHttpError(
      `OpenAI-compatible generation failed: ${response.status} ${sanitizeText(body)}`,
      response.status,
    )
  }

  const payload = chatCompletionResponseWithUsageSchema.parse(await response.json())
  const output = trimToChars(
    extractChatCompletionText(payload).trim(),
    input.config.maxOutputChars,
  )

  return {
    output,
    trace: sanitizeTraceRecord({
      kind: input.kind || 'generation',
      wireApi: 'chat',
      model: input.config.model,
      endpoint: `${baseUrl}/v1/chat/completions`,
      request: {
        systemPromptPreview: systemPrompt,
        promptPreview: input.prompt,
        promptChars: input.prompt.length,
        maxOutputChars: input.config.maxOutputChars,
        temperature: input.config.temperature,
        reasoningEffort: input.config.reasoningEffort,
        store: input.config.store,
      },
      response: {
        responseId: payload.id,
        statusCode: response.status,
        object: payload.object,
        model: payload.model,
        usage: {
          inputTokens: payload.usage?.prompt_tokens,
          outputTokens: payload.usage?.completion_tokens,
          totalTokens: payload.usage?.total_tokens,
        },
        outputPreview: output,
      },
    }),
  }
}

async function callOpenAICompatibleResponses(input: {
  config: OpenAICompatibleGenerationConfig
  prompt: string
  systemPrompt: string
  kind: 'generation' | 'judge'
}): Promise<OpenAICompatibleGenerationResult> {
  const baseUrl = normalizeBaseUrl(input.config.baseUrl)
  const body: Record<string, unknown> = {
    model: input.config.model,
    input: [
      {
        role: 'system',
        content: input.systemPrompt,
      },
      {
        role: 'user',
        content: input.prompt,
      },
    ],
    max_output_tokens: Math.max(
      128,
      Math.ceil(input.config.maxOutputChars / 1.5),
    ),
    store: input.config.store ?? false,
  }
  if (Number.isFinite(input.config.temperature)) {
    body.temperature = input.config.temperature
  }
  if (input.config.reasoningEffort) {
    body.reasoning = {
      effort: input.config.reasoningEffort,
    }
  }

  const response = await withProviderRetry(() =>
    fetch(`${baseUrl}/v1/responses`, {
      method: 'POST',
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: {
        Authorization: `Bearer ${input.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  )

  if (!response.ok) {
    const responseBody = await response.text()
    throw new ProviderHttpError(
      `OpenAI-compatible responses generation failed: ${response.status} ${sanitizeText(responseBody)}`,
      response.status,
    )
  }

  const payload = responsesApiResponseSchema.parse(await response.json())
  const output = trimToChars(
    extractResponsesApiText(payload).trim(),
    input.config.maxOutputChars,
  )

  return {
    output,
    trace: sanitizeTraceRecord({
      kind: input.kind,
      wireApi: 'responses',
      model: input.config.model,
      endpoint: `${baseUrl}/v1/responses`,
      request: {
        systemPromptPreview: input.systemPrompt,
        promptPreview: input.prompt,
        promptChars: input.prompt.length,
        maxOutputChars: input.config.maxOutputChars,
        temperature: input.config.temperature,
        reasoningEffort: input.config.reasoningEffort,
        store: input.config.store,
      },
      response: {
        responseId: payload.id,
        statusCode: response.status,
        object: payload.object,
        model: input.config.model,
        finishedStatus: payload.status,
        usage: {
          inputTokens: payload.usage?.input_tokens,
          outputTokens: payload.usage?.output_tokens,
          totalTokens: payload.usage?.total_tokens,
        },
        outputPreview: output,
      },
    }),
  }
}

function extractChatCompletionText(
  payload: z.infer<typeof chatCompletionResponseSchema>,
) {
  const content = payload.choices[0].message.content
  if (typeof content === 'string') {
    return content
  }

  return content
    .map((part) => part.text || '')
    .filter(Boolean)
    .join('\n')
}

function extractResponsesApiText(
  payload: z.infer<typeof responsesApiResponseSchema>,
) {
  if (payload.output_text) {
    return payload.output_text
  }

  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text || part.output_text || '')
    .filter(Boolean)
    .join('\n')
}

async function withProviderRetry(
  request: () => Promise<Response>,
): Promise<Response> {
  const delayMs = nonNegativeIntegerFromEnv(
    'NOVEL_ENGINE_EVAL_REQUEST_DELAY_MS',
    0,
  )
  const maxRetries = nonNegativeIntegerFromEnv(
    'NOVEL_ENGINE_EVAL_MAX_RETRIES',
    0,
  )
  let attempt = 0

  while (true) {
    if (delayMs > 0) {
      await sleep(delayMs)
    }

    let response: Response
    try {
      response = await request()
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error
      }
      attempt += 1
      continue
    }

    if (
      response.ok ||
      !retryableProviderStatusCodes.has(response.status) ||
      attempt >= maxRetries
    ) {
      return response
    }

    attempt += 1
  }
}

function nonNegativeIntegerFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
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
    const topLevelCase = rawGenerationEvalCaseToConfig({
      chapterId: parsed.chapter_id,
      budgetChars: parsed.budget_chars,
      instruction: parsed.instruction,
      maxOutputChars: parsed.max_output_chars,
      criteria: parsed.criteria,
    })
    const cases = parsed.cases?.length
      ? parsed.cases.map((generationCase) =>
          rawGenerationEvalCaseToConfig({
            caseId: generationCase.id,
            chapterId: generationCase.chapter_id || parsed.chapter_id,
            budgetChars: generationCase.budget_chars || parsed.budget_chars,
            instruction: generationCase.instruction || parsed.instruction,
            maxOutputChars:
              generationCase.max_output_chars || parsed.max_output_chars,
            criteria: generationCase.criteria || parsed.criteria,
          }),
        )
      : [topLevelCase]
    const firstCase = cases[0] || topLevelCase

    return {
      value: {
        ...firstCase,
        cases,
      },
      errors: [],
    }
  } catch (error) {
    return {
      errors: [`meta/generation-eval.json: ${String(error)}`],
    }
  }
}

async function listGenerationEvalCases(rootPath: string) {
  const config = await loadGenerationEvalConfig(resolve(rootPath))
  return config.value?.cases.length
    ? config.value.cases.map((generationCase) => ({
        caseId: generationCase.caseId,
      }))
    : [{ caseId: undefined }]
}

function defaultGenerationConfig(): GenerationEvalConfig {
  const defaultCase = defaultGenerationCaseConfig()
  return {
    ...defaultCase,
    cases: [defaultCase],
  }
}

function defaultGenerationCaseConfig(): GenerationEvalCaseConfig {
  return {
    instruction: defaultInstruction,
    maxOutputChars: defaultMaxOutputChars,
    criteria: [],
  }
}

function rawGenerationEvalCaseToConfig(input: {
  caseId?: string
  chapterId?: string
  budgetChars?: number
  instruction?: string
  maxOutputChars?: number
  criteria?: Array<z.infer<typeof generationCriterionSchema>>
}): GenerationEvalCaseConfig {
  return {
    caseId: input.caseId,
    chapterId: input.chapterId,
    budgetChars: input.budgetChars,
    instruction: input.instruction || defaultInstruction,
    maxOutputChars: input.maxOutputChars || defaultMaxOutputChars,
    criteria: (input.criteria || []).map((criterion) => ({
      id: criterion.id,
      description: criterion.description,
      category: criterion.category,
      contains: criterion.contains,
      containsAny: criterion.contains_any,
      notContains: criterion.not_contains,
    })),
  }
}

function selectGenerationEvalCase(
  config: GenerationEvalConfig,
  caseId?: string,
): GenerationEvalCaseConfig | undefined {
  if (!caseId) {
    return config.cases[0] || config
  }

  return config.cases.find((generationCase) => generationCase.caseId === caseId)
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

async function evaluateGenerationJudge(input: {
  report: GenerationEvalReport
  providerConfig: OpenAICompatibleGenerationConfig
}): Promise<GenerationEvalJudgeReport> {
  const rows = input.report.runs.flatMap((run) => buildJudgeRowsForRun(run))
  const results: GenerationEvalJudgeResult[] = []

  for (const row of rows) {
    results.push(
      await evaluateJudgeRow({
        row,
        providerConfig: input.providerConfig,
      }),
    )
  }

  return {
    enabled: true,
    provider: {
      kind: 'openai-compatible',
      baseUrl: input.providerConfig.baseUrl,
      model: input.providerConfig.model,
      wireApi: input.providerConfig.wireApi,
    },
    results,
    comparisons: [
      buildJudgeComparison('baseline', results),
      buildJudgeComparison('recent-fill', results),
    ],
  }
}

async function evaluateJudgeRow(input: {
  row: GenerationEvalJudgeRow
  providerConfig: OpenAICompatibleGenerationConfig
}): Promise<GenerationEvalJudgeResult> {
  try {
    const result = await callOpenAICompatibleGeneration({
      config: input.providerConfig,
      prompt: input.row.prompt,
      kind: 'judge',
      systemPrompt: [
        '你是严格的中文长篇小说续写盲评裁判。',
        '只能输出 JSON，不要 Markdown，不要解释 JSON 之外的内容。',
        'choice 只能是 "A"、"B" 或 "tie"。',
      ].join('\n'),
    })
    const rawOutput = result.output
    const parsed = parseJudgeResponse(rawOutput)

    return {
      runId: input.row.runId,
      caseId: input.row.caseId,
      chapterId: input.row.chapterId,
      repeatIndex: input.row.repeatIndex,
      pair: input.row.pair,
      order: input.row.order,
      leftArm: input.row.leftArm,
      rightArm: input.row.rightArm,
      choice: mapJudgeChoice({
        rawChoice: parsed.choice,
        leftArm: input.row.leftArm,
        rightArm: input.row.rightArm,
      }),
      rawChoice: parsed.choice,
      reason: parsed.reason,
      trace: result.trace,
    }
  } catch (error) {
    return {
      runId: input.row.runId,
      caseId: input.row.caseId,
      chapterId: input.row.chapterId,
      repeatIndex: input.row.repeatIndex,
      pair: input.row.pair,
      order: input.row.order,
      leftArm: input.row.leftArm,
      rightArm: input.row.rightArm,
      choice: 'invalid',
      rawChoice: 'invalid',
      reason: 'Judge response could not be parsed.',
      error: sanitizeText(String(error)),
    }
  }
}

function parseJudgeResponse(rawOutput: string) {
  const trimmed = rawOutput.trim()
  const jsonText =
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ||
    trimmed.match(/\{[\s\S]*\}/)?.[0] ||
    trimmed
  return judgeResponseSchema.parse(JSON.parse(jsonText))
}

function mapJudgeChoice(input: {
  rawChoice: 'A' | 'B' | 'tie'
  leftArm: GenerationEvalArmId
  rightArm: GenerationEvalArmId
}): GenerationEvalJudgeChoice {
  if (input.rawChoice === 'tie') {
    return 'tie'
  }

  const selectedArm = input.rawChoice === 'A' ? input.leftArm : input.rightArm
  return selectedArm === 'four-layer' ? 'four-layer' : selectedArm
}

function buildJudgeComparison(
  baseline: 'baseline' | 'recent-fill',
  results: GenerationEvalJudgeResult[],
): GenerationEvalJudgeComparison {
  const pairResults = results.filter((result) =>
    result.pair.startsWith(`${baseline}:`),
  )
  const valid = pairResults.filter((result) => result.choice !== 'invalid')
  const fourLayerWins = valid.filter(
    (result) => result.choice === 'four-layer',
  ).length
  const baselineWins = valid.filter((result) => result.choice === baseline).length
  const ties = valid.filter((result) => result.choice === 'tie').length
  const invalid = pairResults.length - valid.length

  return {
    baseline,
    pairedReviews: pairResults.length,
    fourLayerWins,
    baselineWins,
    ties,
    invalid,
    fourLayerWinRate: ratio(fourLayerWins, valid.length),
  }
}

async function archiveGenerationEvalReport(input: {
  archiveDir: string
  report: GenerationEvalReport
}) {
  const archivePath = resolve(input.archiveDir)
  const archivedReport = sanitizeGenerationEvalReportForArchive(input.report)
  await mkdir(archivePath, { recursive: true })
  await writeFile(
    join(archivePath, 'generation-eval-report.json'),
    `${JSON.stringify(archivedReport, null, 2)}\n`,
  )
  await writeFile(
    join(archivePath, 'generation-eval-summary.md'),
    buildGenerationEvalSummary(archivedReport),
  )
  await writeFile(
    join(archivePath, 'human-review.csv'),
    buildHumanReviewCsv(archivedReport),
  )
  await writeFile(
    join(archivePath, 'human-pairwise-review.csv'),
    buildHumanPairwiseReviewCsv(archivedReport),
  )
  await writeFile(
    join(archivePath, 'judge-review-prompts.jsonl'),
    buildJudgeReviewJsonl(archivedReport),
  )
  await writeFile(
    join(archivePath, 'judge-results.json'),
    `${JSON.stringify(archivedReport.judge || emptyJudgeReport(), null, 2)}\n`,
  )
  await writeFile(
    join(archivePath, 'request-traces.json'),
    `${JSON.stringify(buildTraceArchive(archivedReport), null, 2)}\n`,
  )

  return archivePath
}

async function archiveGenerationEvalSuite(input: {
  archiveDir: string
  suite: GenerationEvalSuiteReport
}) {
  const archivePath = resolve(input.archiveDir)
  const archivedSuite = sanitizeGenerationEvalSuiteForArchive(input.suite)
  await mkdir(archivePath, { recursive: true })
  await writeFile(
    join(archivePath, 'generation-eval-suite.json'),
    `${JSON.stringify(archivedSuite, null, 2)}\n`,
  )
  await writeFile(
    join(archivePath, 'generation-eval-suite-summary.md'),
    buildGenerationEvalSuiteSummary(archivedSuite),
  )
  await writeFile(
    join(archivePath, 'human-review.csv'),
    buildSuiteHumanReviewCsv(archivedSuite),
  )
  await writeFile(
    join(archivePath, 'human-pairwise-review.csv'),
    buildSuiteHumanPairwiseReviewCsv(archivedSuite),
  )
  await writeFile(
    join(archivePath, 'judge-review-prompts.jsonl'),
    buildSuiteJudgeReviewJsonl(archivedSuite),
  )
  await writeFile(
    join(archivePath, 'judge-results.json'),
    `${JSON.stringify(buildSuiteJudgeResults(archivedSuite), null, 2)}\n`,
  )
  await writeFile(
    join(archivePath, 'request-traces.json'),
    `${JSON.stringify(buildSuiteTraceArchive(archivedSuite), null, 2)}\n`,
  )

  return archivePath
}

export async function writeArchivedGenerationEvalArtifacts(input: {
  archiveDir: string
  report: GenerationEvalReport
}) {
  return archiveGenerationEvalReport(input)
}

export async function writeArchivedGenerationEvalSuiteArtifacts(input: {
  archiveDir: string
  suite: GenerationEvalSuiteReport
}) {
  return archiveGenerationEvalSuite(input)
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
  const structureLines = report.arms.flatMap((arm) =>
    (arm.structureMetrics || []).map(
      (metric) =>
        `- ${arm.id} ${metric.id}: ${formatPercent(metric.score)} (${metric.numerator}/${metric.denominator})`,
    ),
  )
  const guardLines = report.runs.flatMap((run) =>
    run.arms.flatMap((arm) =>
      (arm.guards || []).map(
        (guard) =>
          `- ${run.id} ${arm.id} ${guard.id}: ${guard.pass ? 'PASS' : 'FAIL'} ${guard.reason}`,
      ),
    ),
  )
  const judgeLines = (report.judge?.comparisons || []).map(
    (comparison) =>
      `- four-layer vs ${comparison.baseline}: win rate ${formatPercent(comparison.fourLayerWinRate)} (${comparison.fourLayerWins}/${comparison.pairedReviews}), baseline wins ${comparison.baselineWins}, ties ${comparison.ties}, invalid ${comparison.invalid}`,
  )

  return `# Generation Eval Summary

- Status: ${report.gate.status}
- Project: ${report.title || report.rootPath}
- Case: ${report.caseId || 'default'}
- Chapter: ${report.chapterId || 'unknown'}
- Repeats: ${report.repeatCount}
- Provider: ${formatProvider(report)}
- Fingerprint: git=${report.fingerprint.gitCommit}, dataset=${report.fingerprint.datasetHash}, config=${report.fingerprint.configHash}
- Archive: ${report.archivePath || 'not archived'}

## Gate

- OK: ${String(report.gate.ok)}
- Reasons: ${report.gate.failedReasonIds.join(', ') || 'none'}

## Arms

${armLines.join('\n') || '- none'}

## Structure Metrics

${structureLines.join('\n') || '- none'}

## Guards

${guardLines.join('\n') || '- none'}

## Comparisons

${comparisonLines.join('\n') || '- none'}

## Judge Review

${judgeLines.join('\n') || '- not run'}

## Human Review

Use \`human-review.csv\` for blind paired review. Deterministic scores only catch hard failures; naturalness, voice, and callback quality still need review.
Use \`judge-review-prompts.jsonl\` for position-swapped judge-model or human pairwise review.
`
}

function buildGenerationEvalSuiteSummary(suite: GenerationEvalSuiteReport) {
  const comparisonLines = suite.comparisons.map(
    (comparison) =>
      `- ${comparison.candidate} vs ${comparison.baseline}: projects ${comparison.projectCount}, paired runs ${comparison.pairedRuns}, callback win rate ${formatPercent(comparison.callbackWinRateMean)}, callback mean diff ${formatNumber(comparison.callbackMeanDiff)}, setting violation diff ${formatNumber(comparison.settingViolationMeanDiff)}, future leak diff ${comparison.futureLeakDiff}`,
  )
  const projectLines = suite.reports.map(
    (report) =>
      `- ${formatReportLabel(report)}: ${report.gate.status}, repeats ${report.repeatCount}, archive ${report.archivePath || 'none'}`,
  )
  const judgeLines = suite.reports.flatMap((report) =>
    (report.judge?.comparisons || []).map(
      (comparison) =>
        `- ${formatReportLabel(report)} four-layer vs ${comparison.baseline}: win rate ${formatPercent(comparison.fourLayerWinRate)} (${comparison.fourLayerWins}/${comparison.pairedReviews}), baseline wins ${comparison.baselineWins}, ties ${comparison.ties}, invalid ${comparison.invalid}`,
    ),
  )

  return `# Generation Eval Suite Summary

- Status: ${suite.ok ? 'pass' : 'fail'}
- Dry run: ${String(suite.dryRun)}
- Projects: ${suite.projectCount}
- Readiness: ${suite.readiness.ok ? 'pass' : 'fail'} (${suite.readiness.loadedProjects}/${suite.readiness.projectCount} loaded, ${suite.readiness.promptReadyProjects}/${suite.readiness.projectCount} prompt-ready, ${suite.readiness.errorCount} errors)
- Paired-run gate: ${suite.dryRun ? 'deferred until non-dry-run generation' : 'checked from generated paired runs'}
- Archive: ${suite.archivePath || 'not archived'}

## Comparisons

${comparisonLines.join('\n') || '- none'}

## Projects

${projectLines.join('\n') || '- none'}

## Judge Review

${judgeLines.join('\n') || '- not run'}

## Human Review

Use the top-level \`human-review.csv\` to review all archived samples together. Deterministic scores remain hard-failure triage, not the final prose-quality judgment.
Use \`judge-review-prompts.jsonl\` for position-swapped judge-model or human pairwise review.
`
}

function buildHumanReviewCsv(report: GenerationEvalReport) {
  const rows = [
    [
      'run_id',
      'case_id',
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
        run.caseId || report.caseId || '',
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

function buildJudgeReviewJsonl(report: GenerationEvalReport) {
  const rows = report.runs.flatMap((run) => buildJudgeRowsForRun(run))
  return `${rows.map((row) => JSON.stringify(row)).join('\n')}${rows.length > 0 ? '\n' : ''}`
}

function buildHumanPairwiseReviewCsv(report: GenerationEvalReport) {
  const rows = [
    [
      'run_id',
      'case_id',
      'chapter_id',
      'repeat_index',
      'pair',
      'order',
      'left_arm',
      'right_arm',
      'left_sample',
      'right_sample',
      'human_choice',
      'human_notes',
    ],
  ]

  for (const run of report.runs) {
    for (const row of buildHumanPairwiseRowsForRun(run)) {
      rows.push([
        row.runId,
        row.caseId || report.caseId || '',
        row.chapterId || '',
        String(row.repeatIndex),
        row.pair,
        row.order,
        row.leftArm,
        row.rightArm,
        row.leftSample,
        row.rightSample,
        '',
        '',
      ])
    }
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function buildSuiteHumanReviewCsv(suite: GenerationEvalSuiteReport) {
  const rows = [
    [
      'project',
      'case_id',
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
          run.caseId || report.caseId || '',
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

function buildSuiteHumanPairwiseReviewCsv(suite: GenerationEvalSuiteReport) {
  const rows = [
    [
      'project',
      'case_id',
      'run_id',
      'chapter_id',
      'repeat_index',
      'pair',
      'order',
      'left_arm',
      'right_arm',
      'left_sample',
      'right_sample',
      'human_choice',
      'human_notes',
    ],
  ]

  for (const report of suite.reports) {
    for (const run of report.runs) {
      for (const row of buildHumanPairwiseRowsForRun(run)) {
        rows.push([
          report.title || report.rootPath,
          row.caseId || report.caseId || '',
          row.runId,
          row.chapterId || '',
          String(row.repeatIndex),
          row.pair,
          row.order,
          row.leftArm,
          row.rightArm,
          row.leftSample,
          row.rightSample,
          '',
          '',
        ])
      }
    }
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function buildSuiteJudgeReviewJsonl(suite: GenerationEvalSuiteReport) {
  const rows = suite.reports.flatMap((report) =>
    report.runs.flatMap((run) =>
      buildJudgeRowsForRun(run).map((row) => ({
        ...row,
        project: report.title || report.rootPath,
      })),
    ),
  )
  return `${rows.map((row) => JSON.stringify(row)).join('\n')}${rows.length > 0 ? '\n' : ''}`
}

function buildSuiteJudgeResults(suite: GenerationEvalSuiteReport) {
  return {
    enabled: suite.reports.some((report) => report.judge?.enabled),
    reports: suite.reports.map((report) => ({
      project: report.title || report.rootPath,
      caseId: report.caseId,
      archivePath: report.archivePath,
      judge: report.judge || emptyJudgeReport(),
    })),
  }
}

function buildTraceArchive(report: GenerationEvalReport) {
  return {
    project: report.title || report.rootPath,
    caseId: report.caseId,
    chapterId: report.chapterId,
    fingerprint: report.fingerprint,
    provider: sanitizeProviderMetadata(report.provider),
    runs: report.runs.map((run) => ({
      runId: run.id,
      caseId: run.caseId,
      chapterId: run.chapterId,
      repeatIndex: run.repeatIndex,
      arms: run.arms.map((arm) => ({
        id: arm.id,
        error: arm.error ? sanitizeText(arm.error) : undefined,
        trace: arm.trace,
      })),
    })),
    judge:
      report.judge?.results.map((result) => ({
        runId: result.runId,
        caseId: result.caseId,
        chapterId: result.chapterId,
        repeatIndex: result.repeatIndex,
        pair: result.pair,
        order: result.order,
        choice: result.choice,
        rawChoice: result.rawChoice,
        reason: sanitizeText(result.reason),
        error: result.error ? sanitizeText(result.error) : undefined,
        trace: result.trace,
      })) || [],
  }
}

function buildSuiteTraceArchive(suite: GenerationEvalSuiteReport) {
  return {
    projectCount: suite.projectCount,
    reports: suite.reports.map((report) => buildTraceArchive(report)),
  }
}

function emptyJudgeReport(): GenerationEvalJudgeReport {
  return {
    enabled: false,
    results: [],
    comparisons: [
      {
        baseline: 'baseline',
        pairedReviews: 0,
        fourLayerWins: 0,
        baselineWins: 0,
        ties: 0,
        invalid: 0,
        fourLayerWinRate: 0,
      },
      {
        baseline: 'recent-fill',
        pairedReviews: 0,
        fourLayerWins: 0,
        baselineWins: 0,
        ties: 0,
        invalid: 0,
        fourLayerWinRate: 0,
      },
    ],
  }
}

function buildHumanPairwiseRowsForRun(
  run: GenerationEvalRunReport,
): GenerationEvalHumanPairwiseRow[] {
  const fourLayer = run.arms.find((arm) => arm.id === 'four-layer')
  const baselines = run.arms.filter(
    (arm) => arm.id === 'baseline' || arm.id === 'recent-fill',
  )
  if (!fourLayer?.output) return []
  const fourLayerOutput = fourLayer.output

  return baselines.flatMap((baseline) => {
    if (!baseline.output) return []
    const baselineOutput = baseline.output
    const base = {
      runId: run.id,
      caseId: run.caseId,
      chapterId: run.chapterId,
      repeatIndex: run.repeatIndex,
      pair: `${baseline.id}:four-layer`,
    }

    return [
      {
        ...base,
        order: 'candidate-right',
        leftArm: baseline.id,
        rightArm: fourLayer.id,
        leftSample: baselineOutput,
        rightSample: fourLayerOutput,
      },
      {
        ...base,
        order: 'candidate-left',
        leftArm: fourLayer.id,
        rightArm: baseline.id,
        leftSample: fourLayerOutput,
        rightSample: baselineOutput,
      },
    ]
  })
}

function buildJudgeRowsForRun(run: GenerationEvalRunReport): GenerationEvalJudgeRow[] {
  const fourLayer = run.arms.find((arm) => arm.id === 'four-layer')
  const baselines = run.arms.filter(
    (arm) => arm.id === 'baseline' || arm.id === 'recent-fill',
  )
  if (!fourLayer?.output) return []
  const fourLayerOutput = fourLayer.output

  return baselines.flatMap((baseline) => {
    if (!baseline.output) return []
    const baselineOutput = baseline.output

    const base = {
      runId: run.id,
      caseId: run.caseId,
      chapterId: run.chapterId,
      repeatIndex: run.repeatIndex,
      pair: `${baseline.id}:four-layer`,
    }

    return [
      {
        ...base,
        order: 'candidate-right',
        leftArm: baseline.id,
        rightArm: fourLayer.id,
        prompt: buildPairwiseJudgePrompt({
          runId: run.id,
          chapterId: run.chapterId,
          repeatIndex: run.repeatIndex,
          leftSample: baselineOutput,
          rightSample: fourLayerOutput,
        }),
      },
      {
        ...base,
        order: 'candidate-left',
        leftArm: fourLayer.id,
        rightArm: baseline.id,
        prompt: buildPairwiseJudgePrompt({
          runId: run.id,
          chapterId: run.chapterId,
          repeatIndex: run.repeatIndex,
          leftSample: fourLayerOutput,
          rightSample: baselineOutput,
        }),
      },
    ]
  })
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
  wireApi?: OpenAICompatibleWireApi
  temperature?: number
  maxOutputChars: number
  reasoningEffort?: string
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
    wireApi:
      input.wireApi ||
      normalizeWireApi(process.env.NOVEL_ENGINE_EVAL_WIRE_API) ||
      'chat',
    temperature: input.temperature ?? Number(process.env.NOVEL_ENGINE_EVAL_TEMPERATURE || 0.4),
    maxOutputChars: input.maxOutputChars,
    reasoningEffort:
      input.reasoningEffort ||
      process.env.NOVEL_ENGINE_EVAL_REASONING_EFFORT,
    store: false,
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
    ...(arm.structureMetrics || []).map(
      (metric) =>
        `Structure ${arm.id}:${metric.id} ${formatPercent(metric.score)} (${metric.numerator}/${metric.denominator})`,
    ),
    ...(arm.guards || []).map(
      (guard) =>
        `Guard ${arm.id}:${guard.id} ${guard.pass ? 'PASS' : 'FAIL'} ${guard.reason}`,
    ),
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

  return `${report.provider.kind} model=${report.provider.model} baseUrl=${report.provider.baseUrl} wire=${report.provider.wireApi || 'chat'}${report.provider.reasoningEffort ? ` reasoning=${report.provider.reasoningEffort}` : ''}`
}

function formatReportLabel(report: GenerationEvalReport) {
  const label = report.title || report.rootPath
  return report.caseId ? `${label} (${report.caseId})` : label
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
  caseId?: string
  chapterId?: string
  budgetChars?: number
}): GenerationEvalReport {
  return {
    rootPath: input.rootPath,
    ok: false,
    dryRun: input.dryRun,
    title: input.title,
    caseId: input.caseId,
    chapterId: input.chapterId,
    budgetChars: input.budgetChars || defaultBudgetChars,
    repeatCount: defaultRepeatCount,
    provider: input.dryRun ? { kind: 'dry-run' } : { kind: 'openai-compatible' },
    fingerprint: emptyFingerprint(),
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

async function buildGenerationFingerprint(input: {
  rootPath: string
  caseId?: string
  chapterId?: string
  instruction: string
  budgetChars: number
  repeatCount: number
  maxOutputChars: number
  provider: {
    model?: string
    wireApi?: OpenAICompatibleWireApi
    reasoningEffort?: string
  }
  criteria: GenerationEvalCriterion[]
}): Promise<GenerationEvalFingerprint> {
  const datasetVersion = await readOptionalFile(
    join(input.rootPath, 'meta', 'project.json'),
  )
  const datasetHash = await hashProjectDataset(input.rootPath)
  const configHash = hashString(
    JSON.stringify({
      caseId: input.caseId,
      chapterId: input.chapterId,
      instruction: input.instruction,
      budgetChars: input.budgetChars,
      repeatCount: input.repeatCount,
      maxOutputChars: input.maxOutputChars,
      provider: input.provider,
      criteria: input.criteria,
    }),
  )

  return {
    gitCommit: await gitCommitHash(),
    datasetVersion: hashString(datasetVersion || input.rootPath),
    datasetHash,
    configHash,
  }
}

function emptyFingerprint(): GenerationEvalFingerprint {
  return {
    gitCommit: 'unknown',
    datasetVersion: 'unknown',
    datasetHash: 'unknown',
    configHash: 'unknown',
  }
}

async function hashProjectDataset(rootPath: string) {
  const files: MarkdownFileSource[] = [
    ...(await collectTextFiles(join(rootPath, 'meta'), rootPath)),
    ...(await collectTextFiles(join(rootPath, 'manuscript'), rootPath)),
    ...(await collectTextFiles(join(rootPath, 'codex'), rootPath)),
  ]
  return hashString(
    files
      .map((file) => `${file.path}\n${file.content}`)
      .sort()
      .join('\n---\n'),
  )
}

async function collectTextFiles(
  rootPath: string,
  projectRoot: string,
): Promise<MarkdownFileSource[]> {
  if (!(await pathExists(rootPath))) {
    return []
  }

  const files: MarkdownFileSource[] = []
  await collectTextPath(rootPath, projectRoot, files)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

async function collectTextPath(
  path: string,
  projectRoot: string,
  files: MarkdownFileSource[],
): Promise<void> {
  const pathStat = await stat(path)

  if (pathStat.isFile()) {
    if (path.endsWith('.md') || path.endsWith('.json') || path.endsWith('.yaml')) {
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
    entries.map((entry) => collectTextPath(join(path, entry.name), projectRoot, files)),
  )
}

async function readOptionalFile(path: string) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return ''
  }
}

async function gitCommitHash() {
  try {
    const [{ stdout }, { stdout: statusStdout }] = await Promise.all([
      execFile('git', ['rev-parse', 'HEAD'], {
        cwd: process.cwd(),
      }),
      execFile('git', ['status', '--porcelain'], {
        cwd: process.cwd(),
      }),
    ])
    return `${stdout.trim()}${statusStdout.trim() ? '-dirty' : ''}`
  } catch {
    return 'unknown'
  }
}

function hashString(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
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

function sanitizeTraceRecord(
  trace: GenerationEvalTraceRecord,
): GenerationEvalTraceRecord {
  return {
    ...trace,
    endpoint: sanitizeEndpoint(trace.endpoint),
    request: {
      ...trace.request,
      systemPromptPreview: sanitizeText(trimPreview(trace.request.systemPromptPreview)),
      promptPreview: sanitizeText(trimPreview(trace.request.promptPreview)),
    },
    response: trace.response
      ? {
          ...trace.response,
          outputPreview: trace.response.outputPreview
            ? sanitizeText(trimPreview(trace.response.outputPreview))
            : undefined,
        }
      : undefined,
    error: trace.error ? sanitizeText(trace.error) : undefined,
  }
}

function sanitizeProviderMetadata(
  provider: GenerationEvalReport['provider'],
): GenerationEvalReport['provider'] {
  if (provider.kind === 'dry-run') {
    return provider
  }

  return {
    ...provider,
    baseUrl: provider.baseUrl ? sanitizeEndpoint(provider.baseUrl) : undefined,
  }
}

function sanitizeEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return `${url.protocol}//[REDACTED-HOST]${url.pathname}`
  } catch {
    return sanitizeText(endpoint)
  }
}

function sanitizeFilesystemPath(path: string) {
  const absolutePath = resolve(path)
  const repoRoot = resolve(process.cwd())
  const relativePath = relative(repoRoot, absolutePath)

  if (relativePath === '') {
    return '.'
  }

  if (!relativePath.startsWith('..') && !isAbsolute(relativePath)) {
    return normalizePath(relativePath)
  }

  return `[REDACTED-PATH]/${basename(absolutePath)}`
}

function sanitizeGenerationEvalJudgeReport(
  judge?: GenerationEvalJudgeReport,
): GenerationEvalJudgeReport | undefined {
  if (!judge) {
    return undefined
  }

  return {
    ...judge,
    provider: judge.provider
      ? {
          ...judge.provider,
          baseUrl: sanitizeEndpoint(judge.provider.baseUrl),
        }
      : undefined,
    results: judge.results.map((result) => ({
      ...result,
      reason: sanitizeText(result.reason),
      error: result.error ? sanitizeText(result.error) : undefined,
      trace: result.trace ? sanitizeTraceRecord(result.trace) : undefined,
    })),
  }
}

function sanitizeGenerationEvalReportForArchive(
  report: GenerationEvalReport,
): GenerationEvalReport {
  return {
    ...report,
    rootPath: sanitizeFilesystemPath(report.rootPath),
    provider: sanitizeProviderMetadata(report.provider),
    runs: report.runs.map((run) => ({
      ...run,
      arms: run.arms.map((arm) => ({
        ...arm,
        error: arm.error ? sanitizeText(arm.error) : undefined,
        trace: arm.trace ? sanitizeTraceRecord(arm.trace) : undefined,
      })),
    })),
    judge: sanitizeGenerationEvalJudgeReport(report.judge),
    archivePath: report.archivePath
      ? sanitizeFilesystemPath(report.archivePath)
      : undefined,
    errors: report.errors.map((error) => sanitizeText(error)),
  }
}

function sanitizeGenerationEvalSuiteForArchive(
  suite: GenerationEvalSuiteReport,
): GenerationEvalSuiteReport {
  return {
    ...suite,
    reports: suite.reports.map((report) =>
      sanitizeGenerationEvalReportForArchive(report),
    ),
    archivePath: suite.archivePath
      ? sanitizeFilesystemPath(suite.archivePath)
      : undefined,
    errors: suite.errors.map((error) => sanitizeText(error)),
  }
}

function sanitizeText(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, '[REDACTED-AUTH]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[REDACTED-KEY]')
    .replace(/\b[A-Za-z0-9]{24,}\b/g, (match) =>
      looksSensitiveToken(match) ? '[REDACTED-TOKEN]' : match,
    )
}

function looksSensitiveToken(value: string) {
  const hasLetter = /[A-Za-z]/.test(value)
  const hasDigit = /\d/.test(value)
  return hasLetter && hasDigit
}

function trimPreview(value: string, maxChars = 2_000) {
  return value.length <= maxChars ? value : `${value.slice(0, maxChars)}…`
}

function normalizeWireApi(value?: string): OpenAICompatibleWireApi | undefined {
  if (value === 'chat' || value === 'responses') {
    return value
  }

  return undefined
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

function safeArchiveSegmentWithCase(path: string, caseId?: string) {
  return caseId ? `${safeArchiveSegment(path)}-${caseId}` : safeArchiveSegment(path)
}

export function parseGenerationEvalArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    rootPath: 'examples/long-memory-benchmark',
    benchmarkProjects: [],
    dryRun: false,
    json: false,
    help: false,
    showPrompts: false,
    judge: false,
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
    } else if (arg === '--case') {
      options.caseId = args[index + 1]
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
    } else if (arg === '--wire-api') {
      options.wireApi = normalizeWireApi(args[index + 1])
      index += 1
    } else if (arg === '--judge') {
      options.judge = true
    } else if (arg === '--judge-model') {
      options.judgeModel = args[index + 1]
      index += 1
    } else if (arg === '--judge-wire-api') {
      options.judgeWireApi = normalizeWireApi(args[index + 1])
      index += 1
    } else if (arg === '--reasoning-effort') {
      options.reasoningEffort = args[index + 1]
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
  NOVEL_ENGINE_EVAL_BASE_URL=https://example.test \\
  NOVEL_ENGINE_EVAL_MODEL=... \\
  NOVEL_ENGINE_EVAL_WIRE_API=responses \\
    npm run generation:eval:long -- --repeat 1 --judge --wire-api responses \\
      --reasoning-effort high --archive-dir .novel/evals/phase0-real-001

The baseline arm receives recent prose only. The recent-fill control receives
the same budget filled with plain recent prose. The four-layer arm receives the
same memory plan used by the editor. Without --dry-run this command calls an
OpenAI-compatible /v1/chat/completions endpoint by default. Use
--wire-api responses for /v1/responses gateways, and --judge to run
position-swapped pairwise judge-model review. Use --benchmark-project more than
once to run a suite across frozen benchmark projects.
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
          caseId: options.caseId,
          chapterId: options.chapterId,
          budgetChars: options.budgetChars,
          dryRun: options.dryRun,
          includePrompts: options.showPrompts,
          repeatCount: options.repeatCount,
          archiveDir: options.archiveDir,
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          model: options.model,
          wireApi: options.wireApi,
          judge: options.judge,
          judgeModel: options.judgeModel,
          judgeWireApi: options.judgeWireApi,
          temperature: options.temperature,
          reasoningEffort: options.reasoningEffort,
          maxOutputChars: options.maxOutputChars,
        })
      : await evaluateGeneration({
          rootPath: options.rootPath,
          caseId: options.caseId,
          chapterId: options.chapterId,
          budgetChars: options.budgetChars,
          dryRun: options.dryRun,
          includePrompts: options.showPrompts,
          repeatCount: options.repeatCount,
          archiveDir: options.archiveDir,
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          model: options.model,
          wireApi: options.wireApi,
          judge: options.judge,
          judgeModel: options.judgeModel,
          judgeWireApi: options.judgeWireApi,
          temperature: options.temperature,
          reasoningEffort: options.reasoningEffort,
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
