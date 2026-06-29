#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
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

export type GenerationEvalArmId = 'baseline' | 'four-layer'
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

export type GenerationEvalGate = {
  status: 'not-run' | 'pass' | 'fail'
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
  provider: {
    kind: 'openai-compatible' | 'dry-run'
    baseUrl?: string
    model?: string
  }
  criteria: GenerationEvalCriterion[]
  arms: GenerationEvalArmReport[]
  gate: GenerationEvalGate
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
  chapterId?: string
  budgetChars?: number
  dryRun: boolean
  json: boolean
  help: boolean
  showPrompts: boolean
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
  baseUrl?: string
  apiKey?: string
  model?: string
  temperature?: number
  maxOutputChars?: number
} = {}): Promise<GenerationEvalReport> {
  const rootPath = resolve(input.rootPath || 'examples/long-memory-benchmark')
  const dryRun = input.dryRun ?? false
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

  if (!dryRun && errors.length === 0) {
    for (const arm of arms) {
      try {
        const output = await callOpenAICompatibleGeneration({
          config: providerConfig,
          prompt: arm.promptPreview,
          instruction: evalConfig.instruction,
        })
        arm.output = output
        arm.outputChars = output.length
        arm.score = scoreGenerationOutput(output, evalConfig.criteria)
      } catch (error) {
        arm.error = String(error)
      }
    }
  }

  const gate = buildGenerationGate(arms)
  const ok =
    errors.length === 0 &&
    arms.every((arm) => !arm.error) &&
    (dryRun || gate.ok)

  return {
    rootPath,
    ok,
    dryRun,
    title: project.title,
    chapterId: chapter.id,
    budgetChars,
    provider: dryRun
      ? { kind: 'dry-run' }
      : {
          kind: 'openai-compatible',
          baseUrl: providerConfig.baseUrl,
          model: providerConfig.model,
        },
    criteria: evalConfig.criteria,
    arms,
    gate,
    errors,
  }
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
  const baseline = report.arms.find((arm) => arm.id === 'baseline')
  const fourLayer = report.arms.find((arm) => arm.id === 'four-layer')
  const lines = [
    `Generation eval: ${report.dryRun ? 'DRY-RUN' : report.gate.status.toUpperCase()}`,
    `Root: ${report.rootPath}`,
    report.title ? `Title: ${report.title}` : undefined,
    report.chapterId ? `Chapter: ${report.chapterId}` : undefined,
    `Budget: ${report.budgetChars} chars`,
    `Provider: ${formatProvider(report)}`,
    `Criteria: ${formatCriteriaSummary(report.criteria)}`,
    baseline && fourLayer && baseline.score && fourLayer.score
      ? `Generation metrics: callbacks ${fourLayer.score.callbackHits}/${fourLayer.score.callbackExpectations} vs ${baseline.score.callbackHits}/${baseline.score.callbackExpectations} baseline; setting violations ${fourLayer.score.settingViolations} vs ${baseline.score.settingViolations} baseline; future leaks ${fourLayer.score.futureLeaks}/${fourLayer.score.futureLeakChecks}`
      : undefined,
    `Gate: ${report.gate.status.toUpperCase()}${report.gate.failedReasonIds.length > 0 ? ` reasons=${report.gate.failedReasonIds.join(',')}` : ''}`,
    ...report.arms.flatMap(formatArmReport),
    ...report.errors.map((error) => `ERROR ${error}`),
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n')
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

function buildGenerationGate(arms: GenerationEvalArmReport[]): GenerationEvalGate {
  const baseline = arms.find((arm) => arm.id === 'baseline')
  const fourLayer = arms.find((arm) => arm.id === 'four-layer')

  if (!baseline?.score || !fourLayer?.score) {
    return {
      status: 'not-run',
      ok: true,
      failedReasonIds: [],
    }
  }

  const failedReasonIds: string[] = []

  if (
    fourLayer.score.callbackExpectations > 0 &&
    fourLayer.score.callbackHits <= baseline.score.callbackHits
  ) {
    failedReasonIds.push('no-callback-gain')
  }

  if (fourLayer.score.settingViolations > baseline.score.settingViolations) {
    failedReasonIds.push('more-setting-violations')
  }

  if (fourLayer.score.futureLeaks > 0) {
    failedReasonIds.push('future-leak')
  }

  if (fourLayer.score.passed < baseline.score.passed) {
    failedReasonIds.push('worse-than-baseline')
  }

  return {
    status: failedReasonIds.length === 0 ? 'pass' : 'fail',
    ok: failedReasonIds.length === 0,
    failedReasonIds,
  }
}

async function callOpenAICompatibleGeneration(input: {
  config: OpenAICompatibleGenerationConfig
  prompt: string
  instruction: string
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
    provider: input.dryRun ? { kind: 'dry-run' } : { kind: 'openai-compatible' },
    criteria: [],
    arms: [],
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

export function parseGenerationEvalArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    rootPath: 'examples/long-memory-benchmark',
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

  return options
}

function printHelp() {
  console.log(`Run a Phase 0 real-generation A/B eval.

Usage:
  npm run generation:eval -- --dry-run
  npm run generation:eval:long -- --dry-run --show-prompts
  NOVEL_ENGINE_EVAL_BASE_URL=http://127.0.0.1:8000 \\
  NOVEL_ENGINE_EVAL_API_KEY=... \\
  NOVEL_ENGINE_EVAL_MODEL=... \\
    npm run generation:eval:long

The baseline arm receives recent prose only. The four-layer arm receives the
same memory plan used by the editor. Without --dry-run this command calls an
OpenAI-compatible /v1/chat/completions endpoint.
`)
}

async function main() {
  const options = parseGenerationEvalArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await evaluateGeneration({
    rootPath: options.rootPath,
    chapterId: options.chapterId,
    budgetChars: options.budgetChars,
    dryRun: options.dryRun,
    includePrompts: options.showPrompts,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    model: options.model,
    temperature: options.temperature,
    maxOutputChars: options.maxOutputChars,
  })

  console.log(
    options.json
      ? JSON.stringify(report, null, 2)
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
