#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

type JudgeChoice = 'four-layer' | 'baseline' | 'recent-fill' | 'tie' | 'invalid'

type PairwiseHumanRow = {
  project?: string
  case_id?: string
  run_id: string
  pair: string
  order: string
  left_arm: string
  right_arm: string
  human_choice?: string
}

type JudgeResult = {
  project?: string
  caseId?: string
  runId: string
  pair: string
  order: string
  choice: JudgeChoice
}

type KappaReport = {
  archiveDir: string
  humanCsvPath: string
  judgeResultsPath: string
  labeledRows: number
  matchedRows: number
  usableRows: number
  blankHumanRows: number
  missingJudgeRows: number
  invalidJudgeRows: number
  observedAgreement: number | null
  expectedAgreement: number | null
  kappa: number | null
  minimumHumanLabels: number
  kappaThreshold: number
  okToTrustJudge: boolean
}

type CliOptions = {
  archiveDir: string
  humanCsvPath?: string
  judgeResultsPath?: string
  outPath?: string
  json: boolean
  help: boolean
}

const minimumHumanLabels = 10
const kappaThreshold = 0.6
const labels = ['four-layer', 'baseline', 'recent-fill', 'tie'] as const

export async function computeKappaFromArchive(input: {
  archiveDir: string
  humanCsvPath?: string
  judgeResultsPath?: string
  outPath?: string
}): Promise<KappaReport> {
  const archiveDir = resolve(input.archiveDir)
  const humanCsvPath =
    input.humanCsvPath || join(archiveDir, 'human-pairwise-review.csv')
  const judgeResultsPath =
    input.judgeResultsPath || join(archiveDir, 'judge-results.json')
  const humanRows = parseCsv(await readFile(humanCsvPath, 'utf8')) as PairwiseHumanRow[]
  const judgeResults = parseJudgeResults(
    JSON.parse(await readFile(judgeResultsPath, 'utf8')) as unknown,
  )
  const judgeByKey = new Map(
    judgeResults.map((result) => [pairKey(result), result]),
  )

  let labeledRows = 0
  let matchedRows = 0
  let blankHumanRows = 0
  let missingJudgeRows = 0
  let invalidJudgeRows = 0
  const humanChoices: string[] = []
  const judgeChoices: string[] = []

  for (const row of humanRows) {
    const humanChoice = normalizeHumanChoice(row)
    if (!humanChoice) {
      blankHumanRows += 1
      continue
    }

    labeledRows += 1
    const judge = judgeByKey.get(pairKey(row))
    if (!judge) {
      missingJudgeRows += 1
      continue
    }

    matchedRows += 1
    if (judge.choice === 'invalid') {
      invalidJudgeRows += 1
      continue
    }

    humanChoices.push(humanChoice)
    judgeChoices.push(judge.choice)
  }

  const agreement = computeCohenKappa(humanChoices, judgeChoices)
  const report: KappaReport = {
    archiveDir,
    humanCsvPath,
    judgeResultsPath,
    labeledRows,
    matchedRows,
    usableRows: humanChoices.length,
    blankHumanRows,
    missingJudgeRows,
    invalidJudgeRows,
    observedAgreement: agreement.observedAgreement,
    expectedAgreement: agreement.expectedAgreement,
    kappa: agreement.kappa,
    minimumHumanLabels,
    kappaThreshold,
    okToTrustJudge:
      humanChoices.length >= minimumHumanLabels &&
      agreement.kappa !== null &&
      agreement.kappa >= kappaThreshold,
  }

  await writeFile(
    input.outPath || join(archiveDir, 'kappa-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  return report
}

function parseJudgeResults(value: unknown): JudgeResult[] {
  if (!value || typeof value !== 'object') {
    return []
  }
  const record = value as {
    results?: unknown
    reports?: Array<{ project?: string; caseId?: string; judge?: { results?: unknown } }>
  }

  if (Array.isArray(record.results)) {
    return record.results.map((item) => normalizeJudgeResult(item, {}))
  }

  if (Array.isArray(record.reports)) {
    return record.reports.flatMap((report) =>
      Array.isArray(report.judge?.results)
        ? report.judge.results.map((item) =>
            normalizeJudgeResult(item, {
              project: report.project,
              caseId: report.caseId,
            }),
          )
        : [],
    )
  }

  return []
}

function normalizeJudgeResult(
  value: unknown,
  defaults: { project?: string; caseId?: string },
): JudgeResult {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    project: stringField(record.project) || defaults.project,
    caseId: stringField(record.caseId) || defaults.caseId,
    runId: stringField(record.runId),
    pair: stringField(record.pair),
    order: stringField(record.order),
    choice: normalizeJudgeChoice(stringField(record.choice)),
  }
}

function normalizeHumanChoice(row: PairwiseHumanRow) {
  const rawChoice = (row.human_choice || '').trim().toLowerCase()
  if (!rawChoice) return undefined
  if (rawChoice === 'tie') return 'tie'
  if (rawChoice === 'a' || rawChoice === 'left') {
    return normalizeArm(row.left_arm)
  }
  if (rawChoice === 'b' || rawChoice === 'right') {
    return normalizeArm(row.right_arm)
  }
  return normalizeArm(rawChoice)
}

function normalizeArm(value: string) {
  if (value === 'four-layer' || value === 'baseline' || value === 'recent-fill') {
    return value
  }
  return undefined
}

function normalizeJudgeChoice(value: string): JudgeChoice {
  if (
    value === 'four-layer' ||
    value === 'baseline' ||
    value === 'recent-fill' ||
    value === 'tie'
  ) {
    return value
  }
  return 'invalid'
}

function pairKey(value: {
  project?: string
  caseId?: string
  case_id?: string
  runId?: string
  run_id?: string
  pair: string
  order: string
}) {
  return [
    value.project || '',
    value.caseId || value.case_id || '',
    value.runId || value.run_id || '',
    value.pair,
    value.order,
  ].join('\u001f')
}

function computeCohenKappa(humanChoices: string[], judgeChoices: string[]) {
  const usableRows = Math.min(humanChoices.length, judgeChoices.length)
  if (usableRows === 0) {
    return {
      observedAgreement: null,
      expectedAgreement: null,
      kappa: null,
    }
  }

  const observedMatches = humanChoices.filter(
    (choice, index) => choice === judgeChoices[index],
  ).length
  const observedAgreement = observedMatches / usableRows
  const expectedAgreement = labels.reduce((total, label) => {
    const humanRate =
      humanChoices.filter((choice) => choice === label).length / usableRows
    const judgeRate =
      judgeChoices.filter((choice) => choice === label).length / usableRows
    return total + humanRate * judgeRate
  }, 0)
  const kappa =
    expectedAgreement === 1
      ? observedAgreement === 1
        ? 1
        : 0
      : (observedAgreement - expectedAgreement) / (1 - expectedAgreement)

  return {
    observedAgreement,
    expectedAgreement,
    kappa,
  }
}

function parseCsv(source: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      index += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += char
  }

  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  const [header = [], ...body] = rows.filter((candidate) =>
    candidate.some((cellValue) => cellValue.length > 0),
  )
  return body.map((candidate) =>
    Object.fromEntries(
      header.map((name, index) => [name, candidate[index] || '']),
    ),
  )
}

function stringField(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function parseJudgeKappaArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    archiveDir: '.novel/evals/latest',
    json: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--archive-dir') {
      options.archiveDir = args[index + 1]
      index += 1
    } else if (arg === '--human-csv') {
      options.humanCsvPath = args[index + 1]
      index += 1
    } else if (arg === '--judge-results') {
      options.judgeResultsPath = args[index + 1]
      index += 1
    } else if (arg === '--out') {
      options.outPath = args[index + 1]
      index += 1
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      options.archiveDir = arg
    }
  }

  return options
}

function printHelp() {
  console.log(`Compute Cohen's kappa for archived pairwise generation eval review.

Usage:
  npm run generation:kappa -- --archive-dir .novel/evals/run
  npm run generation:kappa -- --human-csv human-pairwise-review.csv --judge-results judge-results.json
`)
}

async function main() {
  const options = parseJudgeKappaArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const report = await computeKappaFromArchive({
    archiveDir: options.archiveDir,
    humanCsvPath: options.humanCsvPath,
    judgeResultsPath: options.judgeResultsPath,
    outPath: options.outPath,
  })

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(
      [
        `Kappa: ${report.kappa === null ? 'not-enough-data' : report.kappa.toFixed(3)}`,
        `Usable rows: ${report.usableRows}`,
        `Matched rows: ${report.matchedRows}`,
        `OK to trust judge: ${String(report.okToTrustJudge)}`,
        `Report: ${options.outPath || join(resolve(options.archiveDir), 'kappa-report.json')}`,
      ].join('\n'),
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
