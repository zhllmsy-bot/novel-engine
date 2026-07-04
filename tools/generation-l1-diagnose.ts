#!/usr/bin/env node
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { z } from 'zod'
import { scoreGenerationOutput } from '../src/eval/generationCriteria.ts'
import type { GenerationEvalCriterion } from '../src/eval/generationCriteria.ts'
import {
  generateLocalChapterSummary,
  type ChapterSummary,
} from '../src/memory/chapterSummaryStore.ts'
import { loadProjectFromFiles } from '../src/project/projectFileLoader.ts'
import type { MarkdownFileSource } from '../src/project/projectFileLoader.ts'
import type { NovelProject, ProjectChapter } from '../src/project/projectTypes.ts'
import {
  evaluateGenerationSuite,
  type GenerationEvalArmId,
  type GenerationEvalReport,
} from './generation-eval.ts'

export type GenerationL1CriterionDiagnosis = {
  criterionId: string
  category: GenerationEvalCriterion['category']
  expected: string[]
  classification: GenerationL1CriterionClassification
  localSummaryCovered: boolean
  causalSummaryCovered: boolean
  localPromptCovered: boolean
  causalPromptCovered: boolean
  baselinePromptCovered: boolean
  recentFillPromptCovered: boolean
}

export type GenerationL1CriterionClassification =
  | 'covered-by-local'
  | 'local-l1-summary-gap'
  | 'four-layer-budget-or-ranking-gap'
  | 'causal-fixture-missing-coverage'
  | 'no-positive-criteria'

export type GenerationL1CaseDiagnosis = {
  rootPath: string
  title?: string
  caseId?: string
  chapterId?: string
  criteria: GenerationL1CriterionDiagnosis[]
  localFourLayerSources: string[]
  causalFourLayerSources: string[]
  errors: string[]
}

export type GenerationL1SkippedProject = {
  rootPath: string
  reason: 'missing-causal-fixture'
}

export type GenerationL1DiagnosisReport = {
  ok: boolean
  benchmarkProjects: string[]
  analyzedCases: number
  skippedProjects: GenerationL1SkippedProject[]
  aggregate: {
    positiveCriteria: number
    localSummaryHits: number
    causalSummaryHits: number
    localPromptHits: number
    causalPromptHits: number
    baselinePromptLeaks: number
    recentFillPromptLeaks: number
    classifications: Record<GenerationL1CriterionClassification, number>
  }
  cases: GenerationL1CaseDiagnosis[]
  errors: string[]
}

export type GenerationL1DiagnoseOptions = {
  benchmarkProjects?: string[]
  json?: boolean
  outPath?: string
  help?: boolean
}

export const defaultGenerationL1BenchmarkProjects = [
  'examples/cross-volume-consistency-benchmark',
  'examples/delayed-payoff-benchmark',
  'examples/long-memory-benchmark',
  'examples/lost-in-middle-benchmark',
  'examples/state-drift-benchmark',
]

const l1AblationSummarySchema = z
  .object({
    summaries: z
      .array(
        z
          .object({
            chapter_id: z.string().min(1),
            chapter_title: z.string().min(1).optional(),
            summary: z.string().min(1),
            key_events: z.array(z.string().min(1)).optional(),
            characters_involved: z.array(z.string().min(1)).optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

export async function diagnoseGenerationL1(
  input: GenerationL1DiagnoseOptions = {},
): Promise<GenerationL1DiagnosisReport> {
  const benchmarkProjects = uniqueStrings(
    (input.benchmarkProjects?.length
      ? input.benchmarkProjects
      : defaultGenerationL1BenchmarkProjects
    ).map((rootPath) => resolve(rootPath)),
  )
  const skippedProjects: GenerationL1SkippedProject[] = []
  const rootsWithFixtures: string[] = []

  for (const rootPath of benchmarkProjects) {
    const fixturePath = join(rootPath, 'meta', 'l1-ablation-summaries.json')
    if (await pathExists(fixturePath)) {
      rootsWithFixtures.push(rootPath)
    } else {
      skippedProjects.push({
        rootPath,
        reason: 'missing-causal-fixture',
      })
    }
  }

  const errors: string[] = []
  const cases: GenerationL1CaseDiagnosis[] = []

  if (rootsWithFixtures.length > 0) {
    const [localSuite, causalSuite] = await Promise.all([
      evaluateGenerationSuite({
        rootPaths: rootsWithFixtures,
        l1Mode: 'local',
        dryRun: true,
        includePrompts: true,
        repeatCount: 1,
      }),
      evaluateGenerationSuite({
        rootPaths: rootsWithFixtures,
        l1Mode: 'causal-fixture',
        dryRun: true,
        includePrompts: true,
        repeatCount: 1,
      }),
    ])
    errors.push(...prefixErrors('local-suite', localSuite.errors))
    errors.push(...prefixErrors('causal-suite', causalSuite.errors))

    const causalReports = new Map(
      causalSuite.reports.map((report) => [reportKey(report), report]),
    )

    for (const rootPath of rootsWithFixtures) {
      let project: NovelProject
      let localSummaries: ChapterSummary[]
      let causalSummaries: ChapterSummary[]

      try {
        project = await loadDiagnosisProject(rootPath)
        localSummaries = buildLocalSummaries(project)
        causalSummaries = await loadCausalSummaries(rootPath, project.chapters)
      } catch (error) {
        errors.push(`${rootPath}: ${String(error)}`)
        continue
      }

      for (const localReport of localSuite.reports.filter(
        (report) => resolve(report.rootPath) === rootPath,
      )) {
        const caseErrors = [...localReport.errors]
        const causalReport = causalReports.get(reportKey(localReport))
        if (!causalReport) {
          caseErrors.push('matching causal-fixture report not found')
        } else {
          caseErrors.push(...causalReport.errors)
        }

        const chapter = project.chapters.find(
          (candidate) => candidate.id === localReport.chapterId,
        )
        if (!chapter) {
          caseErrors.push(`chapter not found: ${localReport.chapterId || 'unknown'}`)
        }

        const criteria =
          chapter && causalReport
            ? diagnoseCriteria({
                project,
                chapter,
                localReport,
                causalReport,
                localSummaries,
                causalSummaries,
              })
            : []

        cases.push({
          rootPath,
          title: localReport.title,
          caseId: localReport.caseId,
          chapterId: localReport.chapterId,
          criteria,
          localFourLayerSources: armSources(localReport, 'four-layer'),
          causalFourLayerSources: causalReport
            ? armSources(causalReport, 'four-layer')
            : [],
          errors: caseErrors,
        })
      }
    }
  }

  errors.push(
    ...cases.flatMap((diagnosisCase) =>
      diagnosisCase.errors.map(
        (error) =>
          `${caseLabel(diagnosisCase)}: ${error}`,
      ),
    ),
  )

  return {
    ok: errors.length === 0 && cases.length > 0,
    benchmarkProjects,
    analyzedCases: cases.length,
    skippedProjects,
    aggregate: aggregateCases(cases),
    cases,
    errors,
  }
}

export function formatGenerationL1Diagnosis(
  report: GenerationL1DiagnosisReport,
) {
  const gapCriteria = report.cases.flatMap((diagnosisCase) =>
    diagnosisCase.criteria
      .filter((criterion) =>
        [
          'local-l1-summary-gap',
          'four-layer-budget-or-ranking-gap',
          'causal-fixture-missing-coverage',
        ].includes(criterion.classification),
      )
      .map((criterion) => ({ diagnosisCase, criterion })),
  )
  const classificationLines = Object.entries(report.aggregate.classifications)
    .filter(([, count]) => count > 0)
    .map(([classification, count]) => `  ${classification}: ${count}`)
  const skippedLines = report.skippedProjects.map(
    (project) => `  ${project.rootPath}: ${project.reason}`,
  )
  const gapLines = gapCriteria.map(
    ({ diagnosisCase, criterion }) =>
      `  ${caseLabel(diagnosisCase)} ${criterion.criterionId}: ${criterion.classification}; expected=${criterion.expected.join('|')}; summary local/causal=${hit(criterion.localSummaryCovered)}/${hit(criterion.causalSummaryCovered)}; prompt local/causal=${hit(criterion.localPromptCovered)}/${hit(criterion.causalPromptCovered)}; controls baseline/recent=${hit(criterion.baselinePromptCovered)}/${hit(criterion.recentFillPromptCovered)}`,
  )

  return [
    `Generation L1 diagnosis: ${report.ok ? 'PASS' : 'CHECK'}`,
    `Projects: ${report.benchmarkProjects.length}, analyzed cases: ${report.analyzedCases}, skipped projects: ${report.skippedProjects.length}`,
    `Positive criteria: ${report.aggregate.positiveCriteria}`,
    `Summary coverage: local ${report.aggregate.localSummaryHits}/${report.aggregate.positiveCriteria}, causal ${report.aggregate.causalSummaryHits}/${report.aggregate.positiveCriteria}`,
    `Four-layer prompt coverage: local ${report.aggregate.localPromptHits}/${report.aggregate.positiveCriteria}, causal ${report.aggregate.causalPromptHits}/${report.aggregate.positiveCriteria}`,
    `Control prompt positive leakage: baseline ${report.aggregate.baselinePromptLeaks}/${report.aggregate.positiveCriteria}, recent-fill ${report.aggregate.recentFillPromptLeaks}/${report.aggregate.positiveCriteria}`,
    classificationLines.length > 0
      ? ['Classifications:', ...classificationLines].join('\n')
      : undefined,
    skippedLines.length > 0
      ? ['Skipped projects:', ...skippedLines].join('\n')
      : undefined,
    gapLines.length > 0 ? ['Gaps:', ...gapLines].join('\n') : undefined,
    ...report.errors.map((error) => `ERROR ${error}`),
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

export function parseGenerationL1DiagnoseArgs(
  args: string[],
): GenerationL1DiagnoseOptions {
  const options: GenerationL1DiagnoseOptions = {
    benchmarkProjects: [],
    json: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--benchmark-project' || arg === '--project') {
      const value = args[index + 1]
      if (!value) throw new Error(`${arg} requires a path`)
      options.benchmarkProjects?.push(value)
      index += 1
      continue
    }

    if (arg === '--out') {
      const value = args[index + 1]
      if (!value) throw new Error('--out requires a path')
      options.outPath = value
      index += 1
      continue
    }

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`)
    }

    options.benchmarkProjects?.push(arg)
  }

  return options
}

function diagnoseCriteria(input: {
  project: NovelProject
  chapter: ProjectChapter
  localReport: GenerationEvalReport
  causalReport: GenerationEvalReport
  localSummaries: ChapterSummary[]
  causalSummaries: ChapterSummary[]
}): GenerationL1CriterionDiagnosis[] {
  const localSummaryText = summaryCorpus(
    relevantSummariesForChapter({
      chapter: input.chapter,
      chapters: input.project.chapters,
      summaries: input.localSummaries,
    }),
  )
  const causalSummaryText = summaryCorpus(
    relevantSummariesForChapter({
      chapter: input.chapter,
      chapters: input.project.chapters,
      summaries: input.causalSummaries,
    }),
  )
  const localFourLayerPrompt = armPrompt(input.localReport, 'four-layer')
  const causalFourLayerPrompt = armPrompt(input.causalReport, 'four-layer')
  const baselinePrompt = armPrompt(input.localReport, 'baseline')
  const recentFillPrompt = armPrompt(input.localReport, 'recent-fill')

  return positiveCriteria(input.localReport.criteria).map((criterion) => {
    const localSummaryCovered = positiveCovered(localSummaryText, criterion)
    const causalSummaryCovered = positiveCovered(causalSummaryText, criterion)
    const localPromptCovered = positiveCovered(localFourLayerPrompt, criterion)
    const causalPromptCovered = positiveCovered(causalFourLayerPrompt, criterion)
    const baselinePromptCovered = positiveCovered(baselinePrompt, criterion)
    const recentFillPromptCovered = positiveCovered(recentFillPrompt, criterion)

    return {
      criterionId: criterion.id,
      category: criterion.category,
      expected: expectedPositiveText(criterion),
      classification: classifyCriterion({
        localSummaryCovered,
        causalSummaryCovered,
        localPromptCovered,
        causalPromptCovered,
      }),
      localSummaryCovered,
      causalSummaryCovered,
      localPromptCovered,
      causalPromptCovered,
      baselinePromptCovered,
      recentFillPromptCovered,
    }
  })
}

function classifyCriterion(input: {
  localSummaryCovered: boolean
  causalSummaryCovered: boolean
  localPromptCovered: boolean
  causalPromptCovered: boolean
}): GenerationL1CriterionClassification {
  if (!input.causalSummaryCovered) {
    return 'causal-fixture-missing-coverage'
  }

  if (!input.localSummaryCovered) {
    return 'local-l1-summary-gap'
  }

  if (!input.localPromptCovered || !input.causalPromptCovered) {
    return 'four-layer-budget-or-ranking-gap'
  }

  return 'covered-by-local'
}

function aggregateCases(cases: GenerationL1CaseDiagnosis[]) {
  const classifications: Record<GenerationL1CriterionClassification, number> = {
    'covered-by-local': 0,
    'local-l1-summary-gap': 0,
    'four-layer-budget-or-ranking-gap': 0,
    'causal-fixture-missing-coverage': 0,
    'no-positive-criteria': 0,
  }
  const criteria = cases.flatMap((diagnosisCase) => diagnosisCase.criteria)

  for (const criterion of criteria) {
    classifications[criterion.classification] += 1
  }

  return {
    positiveCriteria: criteria.length,
    localSummaryHits: count(criteria, (criterion) => criterion.localSummaryCovered),
    causalSummaryHits: count(criteria, (criterion) => criterion.causalSummaryCovered),
    localPromptHits: count(criteria, (criterion) => criterion.localPromptCovered),
    causalPromptHits: count(criteria, (criterion) => criterion.causalPromptCovered),
    baselinePromptLeaks: count(
      criteria,
      (criterion) => criterion.baselinePromptCovered,
    ),
    recentFillPromptLeaks: count(
      criteria,
      (criterion) => criterion.recentFillPromptCovered,
    ),
    classifications,
  }
}

function positiveCriteria(criteria: GenerationEvalCriterion[]) {
  return criteria
    .filter(
      (criterion) =>
        (criterion.category === 'callback' || criterion.category === 'setting') &&
        Boolean(criterion.contains?.length || criterion.containsAny?.length),
    )
    .map((criterion) => ({
      id: criterion.id,
      description: criterion.description,
      category: criterion.category,
      contains: criterion.contains,
      containsAny: criterion.containsAny,
      matchThreshold: criterion.matchThreshold,
    }))
}

function positiveCovered(text: string, criterion: GenerationEvalCriterion) {
  return scoreGenerationOutput(text, [criterion]).results[0]?.ok ?? false
}

function expectedPositiveText(criterion: GenerationEvalCriterion) {
  return uniqueStrings([
    ...(criterion.contains || []),
    ...(criterion.containsAny || []),
  ])
}

async function loadDiagnosisProject(rootPath: string) {
  return loadProjectFromFiles({
    rootPath,
    manifestSource: await readFile(join(rootPath, 'meta', 'project.json'), 'utf8'),
    chapterFiles: await collectMarkdownFiles(join(rootPath, 'manuscript'), rootPath),
    codexFiles: await collectMarkdownFiles(join(rootPath, 'codex'), rootPath),
  })
}

function buildLocalSummaries(project: NovelProject): ChapterSummary[] {
  return project.chapters.map((chapter) => {
    const summary = generateLocalChapterSummary({
      chapter,
      content: chapter.content,
      codexEntries: project.codexEntries,
    })

    return {
      ...summary,
      sourceHash: `generation-l1-diagnose:${summary.sourceHash}`,
      updatedAt: '1970-01-01T00:00:00.000Z',
    }
  })
}

async function loadCausalSummaries(
  rootPath: string,
  chapters: ProjectChapter[],
): Promise<ChapterSummary[]> {
  const fixturePath = join(rootPath, 'meta', 'l1-ablation-summaries.json')
  const fixtureSource = await readFile(fixturePath, 'utf8')
  const parsed = l1AblationSummarySchema.parse(JSON.parse(fixtureSource))
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]))

  return parsed.summaries.map((summary): ChapterSummary => {
    const chapter = chaptersById.get(summary.chapter_id)

    return {
      chapterId: summary.chapter_id,
      chapterTitle: summary.chapter_title || chapter?.title || summary.chapter_id,
      summary: summary.summary.trim(),
      keyEvents: (summary.key_events || [])
        .map((event) => event.trim())
        .filter(Boolean),
      charactersInvolved: (summary.characters_involved || [])
        .map((character) => character.trim())
        .filter(Boolean),
      sourceHash: 'generation-l1-diagnose:causal-fixture',
      isEdited: false,
      updatedAt: '1970-01-01T00:00:00.000Z',
    }
  })
}

function relevantSummariesForChapter(input: {
  chapter: ProjectChapter
  chapters: ProjectChapter[]
  summaries: ChapterSummary[]
}) {
  const orders = new Map(input.chapters.map((chapter) => [chapter.id, chapter.order]))
  const currentOrder = orders.get(input.chapter.id) ?? input.chapter.order

  return input.summaries
    .filter((summary) => {
      const summaryOrder = orders.get(summary.chapterId)
      return (
        summary.chapterId === input.chapter.id ||
        (summaryOrder !== undefined && summaryOrder <= currentOrder)
      )
    })
    .toSorted((left, right) => {
      const leftOrder = orders.get(left.chapterId) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = orders.get(right.chapterId) ?? Number.MAX_SAFE_INTEGER
      return leftOrder - rightOrder || left.chapterId.localeCompare(right.chapterId)
    })
}

function summaryCorpus(summaries: ChapterSummary[]) {
  return summaries
    .map((summary) =>
      [
        summary.chapterTitle,
        summary.summary,
        ...summary.keyEvents,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')
}

function reportKey(report: GenerationEvalReport) {
  return [
    resolve(report.rootPath),
    report.caseId || '',
    report.chapterId || '',
  ].join('::')
}

function armPrompt(report: GenerationEvalReport, id: GenerationEvalArmId) {
  const arm = report.arms.find((candidate) => candidate.id === id)
  return arm?.prompt || arm?.promptPreview || ''
}

function armSources(report: GenerationEvalReport, id: GenerationEvalArmId) {
  return report.arms.find((candidate) => candidate.id === id)?.memorySources || []
}

function caseLabel(diagnosisCase: {
  rootPath: string
  title?: string
  caseId?: string
  chapterId?: string
}) {
  const rootName = diagnosisCase.title || relative(process.cwd(), diagnosisCase.rootPath)
  const casePart = diagnosisCase.caseId ? ` case=${diagnosisCase.caseId}` : ''
  const chapterPart = diagnosisCase.chapterId
    ? ` chapter=${diagnosisCase.chapterId}`
    : ''

  return `${rootName}${casePart}${chapterPart}`
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

function prefixErrors(prefix: string, errors: string[]) {
  return errors.map((error) => `${prefix}: ${error}`)
}

function normalizePath(path: string) {
  return path.split('\\').join('/')
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function count<T>(values: T[], predicate: (value: T) => boolean) {
  return values.filter(predicate).length
}

function hit(value: boolean) {
  return value ? 'hit' : 'miss'
}

function usage() {
  return [
    'Usage: npm run generation:l1-diagnose -- [options]',
    '',
    'Options:',
    '  --benchmark-project <path>  Benchmark project root; repeatable.',
    '  --project <path>            Alias for --benchmark-project.',
    '  --out <path>                Write JSON report to path.',
    '  --json                      Print JSON instead of text summary.',
    '  --help                      Show this help.',
  ].join('\n')
}

async function main() {
  const options = parseGenerationL1DiagnoseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const report = await diagnoseGenerationL1(options)

  if (options.outPath) {
    await mkdir(dirname(resolve(options.outPath)), { recursive: true })
    await writeFile(resolve(options.outPath), `${JSON.stringify(report, null, 2)}\n`)
  }

  console.log(
    options.json
      ? JSON.stringify(report, null, 2)
      : formatGenerationL1Diagnosis(report),
  )

  if (!report.ok) {
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
