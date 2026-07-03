#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type {
  GenerationEvalArmId,
  GenerationEvalReport,
  GenerationEvalRunReport,
} from './generation-eval.ts'

type A0Status = 'pass' | 'fail' | 'underpowered'

type CliOptions = {
  localArchive?: string
  fixtureArchive?: string
  outPath?: string
  json: boolean
  help: boolean
}

type A0ComparisonStats = {
  pairedRuns: number
  callbackWins: number
  callbackWinRate: number
  callbackWilson95: {
    lower: number
    upper: number
  }
  settingViolationMeanDiff: number
  futureLeakDiff: number
}

type A0MatchedReport = {
  key: string
  local: A0ComparisonStats
  fixture: A0ComparisonStats
  callbackWinRateDelta: number
  settingViolationRegression: number
  futureLeakRegression: number
}

type A0Report = {
  status: A0Status
  ok: boolean
  failedReasonIds: string[]
  localArchive: string
  fixtureArchive: string
  primaryMetric: 'callback-structural-win-rate'
  judgeUse: 'excluded-uncalibrated'
  thresholds: {
    callbackWinRateDelta: number
    fixtureWilsonLower: number
  }
  aggregate: A0MatchedReport
  reports: A0MatchedReport[]
  warnings: string[]
}

const baselineArmId: GenerationEvalArmId = 'recent-fill'
const candidateArmId: GenerationEvalArmId = 'four-layer'
const callbackDeltaThreshold = 0.15
const fixtureWilsonLowerThreshold = 0.5

export async function compareA0Archives(input: {
  localArchive: string
  fixtureArchive: string
  outPath?: string
}): Promise<A0Report> {
  const localArchive = resolve(input.localArchive)
  const fixtureArchive = resolve(input.fixtureArchive)
  const localReports = await readArchiveReports(localArchive)
  const fixtureReports = await readArchiveReports(fixtureArchive)
  const fixtureByKey = new Map(fixtureReports.map((report) => [reportKey(report), report]))
  const warnings: string[] = []
  const matched: A0MatchedReport[] = []

  for (const localReport of localReports) {
    const key = reportKey(localReport)
    const fixtureReport = fixtureByKey.get(key)
    if (!fixtureReport) {
      warnings.push(`missing fixture report for ${key}`)
      continue
    }

    matched.push(compareReports(key, localReport, fixtureReport))
  }

  const failedReasonIds = validateArchiveModes(localReports, fixtureReports)
  if (matched.length === 0) {
    failedReasonIds.push('no-matched-reports')
  }

  const aggregate = aggregateMatches(matched)
  failedReasonIds.push(...evaluateA0Reasons(aggregate))
  const status = statusFromReasons(failedReasonIds)
  const report: A0Report = {
    status,
    ok: status === 'pass',
    failedReasonIds,
    localArchive,
    fixtureArchive,
    primaryMetric: 'callback-structural-win-rate',
    judgeUse: 'excluded-uncalibrated',
    thresholds: {
      callbackWinRateDelta: callbackDeltaThreshold,
      fixtureWilsonLower: fixtureWilsonLowerThreshold,
    },
    aggregate,
    reports: matched,
    warnings,
  }

  if (input.outPath) {
    await writeFile(input.outPath, `${JSON.stringify(report, null, 2)}\n`)
  }

  return report
}

function compareReports(
  key: string,
  localReport: GenerationEvalReport,
  fixtureReport: GenerationEvalReport,
): A0MatchedReport {
  const local = comparisonStats(localReport.runs)
  const fixture = comparisonStats(fixtureReport.runs)

  return {
    key,
    local,
    fixture,
    callbackWinRateDelta: fixture.callbackWinRate - local.callbackWinRate,
    settingViolationRegression:
      fixture.settingViolationMeanDiff - local.settingViolationMeanDiff,
    futureLeakRegression: fixture.futureLeakDiff - local.futureLeakDiff,
  }
}

function aggregateMatches(matches: A0MatchedReport[]): A0MatchedReport {
  const local = aggregateStats(matches.map((match) => match.local))
  const fixture = aggregateStats(matches.map((match) => match.fixture))

  return {
    key: 'aggregate',
    local,
    fixture,
    callbackWinRateDelta: fixture.callbackWinRate - local.callbackWinRate,
    settingViolationRegression:
      fixture.settingViolationMeanDiff - local.settingViolationMeanDiff,
    futureLeakRegression: fixture.futureLeakDiff - local.futureLeakDiff,
  }
}

function aggregateStats(stats: A0ComparisonStats[]): A0ComparisonStats {
  const pairedRuns = sum(stats.map((item) => item.pairedRuns))
  const callbackWins = sum(stats.map((item) => item.callbackWins))
  const settingDiffTotal = sum(
    stats.map((item) => item.settingViolationMeanDiff * item.pairedRuns),
  )
  const futureLeakDiff = sum(stats.map((item) => item.futureLeakDiff))

  return {
    pairedRuns,
    callbackWins,
    callbackWinRate: ratio(callbackWins, pairedRuns),
    callbackWilson95: wilsonInterval(callbackWins, pairedRuns),
    settingViolationMeanDiff: ratio(settingDiffTotal, pairedRuns),
    futureLeakDiff,
  }
}

function comparisonStats(runs: GenerationEvalRunReport[]): A0ComparisonStats {
  const pairs = runs
    .map((run) => {
      const candidate = run.arms.find((arm) => arm.id === candidateArmId)
      const baseline = run.arms.find((arm) => arm.id === baselineArmId)
      if (!candidate?.score || !baseline?.score) {
        return undefined
      }

      return {
        callbackDiff:
          (candidate.score.callbackHits || 0) -
          (baseline.score.callbackHits || 0),
        settingViolationDiff:
          (candidate.score.settingViolations || 0) -
          (baseline.score.settingViolations || 0),
        futureLeakDiff:
          (candidate.score.futureLeaks || 0) -
          (baseline.score.futureLeaks || 0),
      }
    })
    .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair))
  const callbackWins = pairs.filter((pair) => pair.callbackDiff > 0).length

  return {
    pairedRuns: pairs.length,
    callbackWins,
    callbackWinRate: ratio(callbackWins, pairs.length),
    callbackWilson95: wilsonInterval(callbackWins, pairs.length),
    settingViolationMeanDiff: ratio(
      sum(pairs.map((pair) => pair.settingViolationDiff)),
      pairs.length,
    ),
    futureLeakDiff: sum(pairs.map((pair) => pair.futureLeakDiff)),
  }
}

function evaluateA0Reasons(aggregate: A0MatchedReport) {
  const reasons: string[] = []

  if (aggregate.fixture.pairedRuns === 0 || aggregate.local.pairedRuns === 0) {
    reasons.push('underpowered-no-paired-runs')
    return reasons
  }

  if (aggregate.callbackWinRateDelta < callbackDeltaThreshold) {
    reasons.push('insufficient-callback-delta')
  }

  if (aggregate.settingViolationRegression > 0) {
    reasons.push('setting-violation-regression')
  }

  if (aggregate.futureLeakRegression > 0) {
    reasons.push('future-leak-regression')
  }

  if (
    aggregate.callbackWinRateDelta >= callbackDeltaThreshold &&
    aggregate.fixture.callbackWilson95.lower <= fixtureWilsonLowerThreshold
  ) {
    reasons.push('underpowered-callback-wilson-lower-bound')
  }

  return reasons
}

function statusFromReasons(reasons: string[]): A0Status {
  if (reasons.length === 0) {
    return 'pass'
  }

  return reasons.some((reason) => reason.startsWith('underpowered'))
    ? 'underpowered'
    : 'fail'
}

function validateArchiveModes(
  localReports: GenerationEvalReport[],
  fixtureReports: GenerationEvalReport[],
) {
  const reasons: string[] = []

  if (localReports.some((report) => report.a0?.l1Mode !== 'local')) {
    reasons.push('local-archive-not-local-l1')
  }

  if (fixtureReports.some((report) => report.a0?.l1Mode !== 'causal-fixture')) {
    reasons.push('fixture-archive-not-causal-fixture-l1')
  }

  return reasons
}

async function readArchiveReports(archiveDir: string): Promise<GenerationEvalReport[]> {
  const suitePath = join(archiveDir, 'generation-eval-suite.json')
  const reportPath = join(archiveDir, 'generation-eval-report.json')

  try {
    const parsed = JSON.parse(await readFile(suitePath, 'utf8')) as {
      reports?: GenerationEvalReport[]
    }
    if (Array.isArray(parsed.reports)) {
      return parsed.reports
    }
  } catch {
    // Fall through to single-report archive.
  }

  const parsed = JSON.parse(await readFile(reportPath, 'utf8')) as GenerationEvalReport
  return [parsed]
}

function reportKey(report: GenerationEvalReport) {
  return [
    report.title || report.rootPath,
    report.caseId || 'default',
    report.chapterId || 'unknown',
  ].join('\u001f')
}

export function parseGenerationA0Args(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--local-archive') {
      options.localArchive = args[index + 1]
      index += 1
    } else if (arg === '--fixture-archive') {
      options.fixtureArchive = args[index + 1]
      index += 1
    } else if (arg === '--out') {
      options.outPath = args[index + 1]
      index += 1
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    }
  }

  return options
}

export function formatA0Report(report: A0Report) {
  return [
    `A0 L1 ablation: ${report.status.toUpperCase()}`,
    `Primary: ${report.primaryMetric}`,
    `Judge: ${report.judgeUse}`,
    `Local archive: ${report.localArchive}`,
    `Fixture archive: ${report.fixtureArchive}`,
    `Callback delta: ${formatNumber(report.aggregate.callbackWinRateDelta)} (threshold ${formatNumber(report.thresholds.callbackWinRateDelta)})`,
    `Fixture callback win: ${formatPercent(report.aggregate.fixture.callbackWinRate)} (${report.aggregate.fixture.callbackWins}/${report.aggregate.fixture.pairedRuns}), Wilson95 ${formatPercent(report.aggregate.fixture.callbackWilson95.lower)}-${formatPercent(report.aggregate.fixture.callbackWilson95.upper)}`,
    `Safety: setting regression ${formatNumber(report.aggregate.settingViolationRegression)}, future leak regression ${formatNumber(report.aggregate.futureLeakRegression)}`,
    `Reasons: ${report.failedReasonIds.join(', ') || 'none'}`,
    ...report.warnings.map((warning) => `WARN ${warning}`),
  ].join('\n')
}

function wilsonInterval(successes: number, trials: number) {
  if (trials <= 0) {
    return { lower: 0, upper: 0 }
  }

  const z = 1.96
  const phat = successes / trials
  const denominator = 1 + (z ** 2) / trials
  const center = phat + (z ** 2) / (2 * trials)
  const margin = z * Math.sqrt((phat * (1 - phat) + (z ** 2) / (4 * trials)) / trials)

  return {
    lower: Math.max(0, (center - margin) / denominator),
    upper: Math.min(1, (center + margin) / denominator),
  }
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function printHelp() {
  console.log(`Compare A0 local-L1 and oracle causal-fixture generation archives.

Usage:
  npm run generation:a0 -- --local-archive .novel/evals/a0-local \\
    --fixture-archive .novel/evals/a0-causal

Only deterministic generation scores are used. Judge-model results are excluded
because A0 runs before judge calibration.
`)
}

async function main() {
  const options = parseGenerationA0Args(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  if (!options.localArchive || !options.fixtureArchive) {
    console.error('Missing --local-archive or --fixture-archive')
    process.exitCode = 1
    return
  }

  const report = await compareA0Archives({
    localArchive: options.localArchive,
    fixtureArchive: options.fixtureArchive,
    outPath: options.outPath,
  })

  console.log(options.json ? JSON.stringify(report, null, 2) : formatA0Report(report))

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
