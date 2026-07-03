#!/usr/bin/env node
import { createHash } from 'node:crypto'
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

type HumanAuditRow = {
  review_item_id?: string
  item_kind?: string
  canonical_packet_id?: string
  expected_choice?: string
  duplicate_of?: string
  shown_index?: string
  started_at?: string
  submitted_at?: string
  elapsed_ms?: string
  packet_id?: string
  project?: string
  case_id?: string
  run_id: string
  chapter_id?: string
  repeat_index?: string
  pair: string
  order: string
  left_arm: string
  right_arm: string
  judge_choice?: string
  human_choice?: string
  human_accepts_judge?: string
  human_notes?: string
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
  humanAuditPath?: string
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
  auditRows: number
  auditAcceptedRows: number
  auditRejectedRows: number
  auditBlankAcceptRows: number
  auditPassRate: number | null
  auditPassRateThreshold: number
  duplicateRows: number
  duplicatePairs: number
  duplicateConsistent: number
  duplicateBlankRows: number
  duplicateConsistency: number | null
  duplicateConsistencyThreshold: number
  okToTrustJudge: boolean
}

type HumanAuditTemplateReport = {
  archiveDir: string
  auditPacketsPath: string
  humanAuditPath: string
  packets: number
  rows: number
}

type ReviewQueueReport = {
  archiveDir: string
  auditPacketsPath: string
  reviewQueuePath: string
  packets: number
  canonicalRows: number
  duplicateRows: number
  rows: number
  duplicateRate: number
  seed: string
}

type CliOptions = {
  archiveDir: string
  humanCsvPath?: string
  humanAuditPath?: string
  auditPacketsPath?: string
  judgeResultsPath?: string
  outPath?: string
  buildHumanAudit: boolean
  buildReviewQueue: boolean
  json: boolean
  help: boolean
}

const minimumHumanLabels = 10
const kappaThreshold = 0.6
const auditPassRateThreshold = 0.9
const duplicateConsistencyThreshold = 0.9
const labels = ['four-layer', 'baseline', 'recent-fill', 'tie'] as const

export async function computeKappaFromArchive(input: {
  archiveDir: string
  humanCsvPath?: string
  humanAuditPath?: string
  judgeResultsPath?: string
  outPath?: string
}): Promise<KappaReport> {
  const archiveDir = resolve(input.archiveDir)
  const humanCsvPath = input.humanCsvPath || join(archiveDir, 'human-pairwise-review.csv')
  const humanAuditPath = input.humanAuditPath
  const judgeResultsPath =
    input.judgeResultsPath || join(archiveDir, 'judge-results.json')
  const humanRows = humanAuditPath
    ? parseTsv(await readFile(humanAuditPath, 'utf8')) as HumanAuditRow[]
    : parseCsv(await readFile(humanCsvPath, 'utf8')) as PairwiseHumanRow[]
  const judgeResults = parseJudgeResults(
    JSON.parse(await readFile(judgeResultsPath, 'utf8')) as unknown,
  )
  const judgeByKey = new Map(
    judgeResults.map((result) => [pairKey(result), result]),
  )
  const judgeByProjectlessKey = new Map(
    judgeResults.map((result) => [pairKey({ ...result, project: '' }), result]),
  )

  let labeledRows = 0
  let matchedRows = 0
  let blankHumanRows = 0
  let missingJudgeRows = 0
  let invalidJudgeRows = 0
  let auditAcceptedRows = 0
  let auditRejectedRows = 0
  let auditBlankAcceptRows = 0
  const humanChoices: string[] = []
  const judgeChoices: string[] = []
  const duplicateStats = humanAuditPath
    ? computeDuplicateConsistency(humanRows as HumanAuditRow[])
    : {
        duplicateRows: 0,
        duplicatePairs: 0,
        duplicateConsistent: 0,
        duplicateBlankRows: 0,
        duplicateConsistency: null,
      }

  for (const row of humanRows) {
    const scoreAsCanonical = !humanAuditPath || isCanonicalReviewRow(row)
    const auditAcceptance = normalizeAuditAcceptance(row)
    if (humanAuditPath && scoreAsCanonical) {
      if (auditAcceptance === true) {
        auditAcceptedRows += 1
      } else if (auditAcceptance === false) {
        auditRejectedRows += 1
      } else {
        auditBlankAcceptRows += 1
      }
    }
    if (!scoreAsCanonical) {
      continue
    }

    const humanChoice = normalizeHumanChoice(row)
    if (!humanChoice) {
      blankHumanRows += 1
      continue
    }

    labeledRows += 1
    const judge = judgeByKey.get(pairKey(row)) || judgeByProjectlessKey.get(
      pairKey({ ...row, project: '' }),
    )
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
  const auditAcceptDecisions = auditAcceptedRows + auditRejectedRows
  const auditPassRate =
    humanAuditPath && auditAcceptDecisions > 0
      ? auditAcceptedRows / auditAcceptDecisions
      : null
  const duplicateReliabilityOk =
    duplicateStats.duplicateRows === 0 ||
    (duplicateStats.duplicateBlankRows === 0 &&
      duplicateStats.duplicateConsistency !== null &&
      duplicateStats.duplicateConsistency >= duplicateConsistencyThreshold)
  const report: KappaReport = {
    archiveDir,
    humanCsvPath,
    humanAuditPath,
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
    auditRows: humanAuditPath ? humanRows.length : 0,
    auditAcceptedRows,
    auditRejectedRows,
    auditBlankAcceptRows,
    auditPassRate,
    auditPassRateThreshold,
    duplicateRows: duplicateStats.duplicateRows,
    duplicatePairs: duplicateStats.duplicatePairs,
    duplicateConsistent: duplicateStats.duplicateConsistent,
    duplicateBlankRows: duplicateStats.duplicateBlankRows,
    duplicateConsistency: duplicateStats.duplicateConsistency,
    duplicateConsistencyThreshold,
    okToTrustJudge:
      humanChoices.length >= minimumHumanLabels &&
      agreement.kappa !== null &&
      agreement.kappa >= kappaThreshold &&
      (!humanAuditPath ||
        (auditBlankAcceptRows === 0 &&
          auditPassRate !== null &&
          auditPassRate >= auditPassRateThreshold &&
          duplicateReliabilityOk)),
  }

  await writeFile(
    input.outPath || join(archiveDir, 'kappa-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  return report
}

export async function buildHumanAuditTemplateFromArchive(input: {
  archiveDir: string
  auditPacketsPath?: string
  outPath?: string
}): Promise<HumanAuditTemplateReport> {
  const archiveDir = resolve(input.archiveDir)
  const auditPacketsPath =
    input.auditPacketsPath || join(archiveDir, 'audit-packets.jsonl')
  const humanAuditPath = input.outPath || join(archiveDir, 'human-audit.tsv')
  const packets = parseJsonl(await readFile(auditPacketsPath, 'utf8')) as Array<
    Record<string, unknown>
  >
  const rows = packets.map((packet) => auditPacketToHumanAuditRow(packet))

  await writeFile(humanAuditPath, buildTsv(rows))

  return {
    archiveDir,
    auditPacketsPath,
    humanAuditPath,
    packets: packets.length,
    rows: rows.length,
  }
}

export async function buildReviewQueueFromArchive(input: {
  archiveDir: string
  auditPacketsPath?: string
  outPath?: string
}): Promise<ReviewQueueReport> {
  const archiveDir = resolve(input.archiveDir)
  const auditPacketsPath =
    input.auditPacketsPath || join(archiveDir, 'audit-packets.jsonl')
  const reviewQueuePath = input.outPath || join(archiveDir, 'review-queue.tsv')
  const packets = parseJsonl(await readFile(auditPacketsPath, 'utf8')) as Array<
    Record<string, unknown>
  >
  const seed = shortHash(packets.map((packet) => stringField(packet.packetId)).join('\n'))
  const canonicalRows = packets.map((packet) => {
    const row = auditPacketToHumanAuditRow(packet)
    return {
      ...row,
      review_item_id: `review-${shortHash(row.packet_id)}`,
      item_kind: 'canonical',
      canonical_packet_id: row.packet_id,
      expected_choice: '',
      duplicate_of: '',
      shown_index: '',
      started_at: '',
      submitted_at: '',
      elapsed_ms: '',
    }
  })
  const duplicateCount =
    canonicalRows.length >= 2
      ? Math.min(canonicalRows.length, Math.max(2, Math.round(canonicalRows.length * 0.12)))
      : 0
  const duplicateSourceRows = [...canonicalRows]
    .sort((left, right) =>
      hashText(`${seed}:duplicate:${left.packet_id}`).localeCompare(
        hashText(`${seed}:duplicate:${right.packet_id}`),
      ),
    )
    .slice(0, duplicateCount)
  const duplicateRows = duplicateSourceRows.map((row, index) => ({
    ...row,
    review_item_id: `${row.review_item_id}-dup-${index + 1}`,
    item_kind: 'duplicate',
    duplicate_of: row.review_item_id,
    human_choice: '',
    human_accepts_judge: '',
    human_notes: '',
    started_at: '',
    submitted_at: '',
    elapsed_ms: '',
  }))
  const rows = [...canonicalRows, ...duplicateRows]
    .sort((left, right) =>
      hashText(`${seed}:shown:${left.review_item_id}`).localeCompare(
        hashText(`${seed}:shown:${right.review_item_id}`),
      ),
    )
    .map((row, index) => ({
      ...row,
      shown_index: String(index + 1),
    }))

  await writeFile(reviewQueuePath, buildReviewQueueTsv(rows))

  return {
    archiveDir,
    auditPacketsPath,
    reviewQueuePath,
    packets: packets.length,
    canonicalRows: canonicalRows.length,
    duplicateRows: duplicateRows.length,
    rows: rows.length,
    duplicateRate: canonicalRows.length > 0 ? duplicateRows.length / canonicalRows.length : 0,
    seed,
  }
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

function normalizeAuditAcceptance(row: Record<string, unknown>) {
  const rawAcceptance = stringField(row.human_accepts_judge).trim().toLowerCase()
  if (!rawAcceptance) return undefined
  if (['yes', 'y', 'true', '1', 'accept', 'accepted', 'pass'].includes(rawAcceptance)) {
    return true
  }
  if (['no', 'n', 'false', '0', 'reject', 'rejected', 'fail'].includes(rawAcceptance)) {
    return false
  }
  return undefined
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

function parseTsv(source: string): Array<Record<string, string>> {
  const rows = source
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split('\t'))
  const [header = [], ...body] = rows
  return body.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] || ''])),
  )
}

function parseJsonl(source: string) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown)
}

function auditPacketToHumanAuditRow(packet: Record<string, unknown>) {
  const judge = objectField(packet.judge)
  return {
    packet_id: stringField(packet.packetId),
    project: stringField(packet.project),
    case_id: stringField(packet.caseId),
    run_id: stringField(packet.runId),
    chapter_id: stringField(packet.chapterId),
    repeat_index: stringField(packet.repeatIndex) || String(numberField(packet.repeatIndex) || ''),
    pair: stringField(packet.pair),
    order: stringField(packet.order),
    left_arm: stringField(packet.leftArm),
    right_arm: stringField(packet.rightArm),
    judge_choice: stringField(judge.choice),
    judge_raw_choice: stringField(judge.rawChoice),
    needle_mapping_ratio: needleMappingRatio(packet),
    unmapped_criteria: unmappedCriteria(packet),
    l0_needles: compactNeedles(packet),
    left_sample: stringField(packet.leftSample),
    right_sample: stringField(packet.rightSample),
    human_choice: '',
    human_accepts_judge: '',
    human_notes: '',
  }
}

function buildTsv(rows: Array<Record<string, string>>) {
  const header = [
    'packet_id',
    'project',
    'case_id',
    'run_id',
    'chapter_id',
    'repeat_index',
    'pair',
    'order',
    'left_arm',
    'right_arm',
    'judge_choice',
    'judge_raw_choice',
    'needle_mapping_ratio',
    'unmapped_criteria',
    'l0_needles',
    'left_sample',
    'right_sample',
    'human_choice',
    'human_accepts_judge',
    'human_notes',
  ]
  return `${[
    header.join('\t'),
    ...rows.map((row) => header.map((field) => tsvCell(row[field] || '')).join('\t')),
  ].join('\n')}\n`
}

function buildReviewQueueTsv(rows: Array<Record<string, string>>) {
  const header = [
    'review_item_id',
    'item_kind',
    'canonical_packet_id',
    'expected_choice',
    'duplicate_of',
    'shown_index',
    'started_at',
    'submitted_at',
    'elapsed_ms',
    'packet_id',
    'project',
    'case_id',
    'run_id',
    'chapter_id',
    'repeat_index',
    'pair',
    'order',
    'left_arm',
    'right_arm',
    'judge_choice',
    'judge_raw_choice',
    'needle_mapping_ratio',
    'unmapped_criteria',
    'l0_needles',
    'left_sample',
    'right_sample',
    'human_choice',
    'human_accepts_judge',
    'human_notes',
  ]
  return `${[
    header.join('\t'),
    ...rows.map((row) => header.map((field) => tsvCell(row[field] || '')).join('\t')),
  ].join('\n')}\n`
}

function isCanonicalReviewRow(row: Record<string, unknown>) {
  const itemKind = stringField(row.item_kind).trim()
  return itemKind === '' || itemKind === 'canonical'
}

function computeDuplicateConsistency(rows: HumanAuditRow[]) {
  const duplicateRows = rows.filter((row) => row.item_kind === 'duplicate')
  const canonicalByReviewId = new Map(
    rows
      .filter((row) => isCanonicalReviewRow(row))
      .map((row) => [row.review_item_id || '', row]),
  )
  let duplicatePairs = 0
  let duplicateConsistent = 0
  let duplicateBlankRows = 0

  for (const duplicate of duplicateRows) {
    const canonical = canonicalByReviewId.get(duplicate.duplicate_of || '')
    const duplicateChoice = normalizeHumanChoice(duplicate)
    const canonicalChoice = canonical ? normalizeHumanChoice(canonical) : undefined
    const duplicateAcceptance = normalizeAuditAcceptance(duplicate)
    const canonicalAcceptance = canonical ? normalizeAuditAcceptance(canonical) : undefined

    if (
      !canonical ||
      !duplicateChoice ||
      !canonicalChoice ||
      duplicateAcceptance === undefined ||
      canonicalAcceptance === undefined
    ) {
      duplicateBlankRows += 1
      continue
    }

    duplicatePairs += 1
    if (
      duplicateChoice === canonicalChoice &&
      duplicateAcceptance === canonicalAcceptance
    ) {
      duplicateConsistent += 1
    }
  }

  return {
    duplicateRows: duplicateRows.length,
    duplicatePairs,
    duplicateConsistent,
    duplicateBlankRows,
    duplicateConsistency:
      duplicatePairs > 0 ? duplicateConsistent / duplicatePairs : null,
  }
}

function compactNeedles(packet: Record<string, unknown>) {
  const needles = Array.isArray(packet.needles) ? packet.needles : []
  return needles
    .map((needle) => {
      const record = objectField(needle)
      const entries = Array.isArray(record.codexEntries) ? record.codexEntries : []
      const entryText = entries
        .map((entry) => {
          const codex = objectField(entry)
          return [
            stringField(codex.id),
            stringField(codex.name),
            stringField(codex.path),
            stringField(codex.excerpt),
          ]
            .filter(Boolean)
            .join(' | ')
        })
        .join(' || ')
      return [
        stringField(record.criterionId),
        stringField(record.status),
        stringField(record.reason),
        entryText,
      ]
        .filter(Boolean)
        .join(' :: ')
    })
    .join(' ### ')
}

function needleMappingRatio(packet: Record<string, unknown>) {
  const coverage = objectField(packet.needleMappingCoverage)
  const ratio = numberField(coverage.ratio)
  return Number.isFinite(ratio) ? ratio.toFixed(3) : ''
}

function unmappedCriteria(packet: Record<string, unknown>) {
  const coverage = objectField(packet.needleMappingCoverage)
  return Array.isArray(coverage.unmappedCriterionIds)
    ? coverage.unmappedCriterionIds.map((value) => String(value)).join(',')
    : ''
}

function stringField(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function shortHash(value: string) {
  return hashText(value).slice(0, 12)
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function numberField(value: unknown) {
  return typeof value === 'number' ? value : Number.NaN
}

function objectField(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function tsvCell(value: string) {
  return value.replaceAll('\t', ' ').replaceAll('\n', ' ').replaceAll('\r', ' ')
}

export function parseJudgeKappaArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    archiveDir: '.novel/evals/latest',
    buildHumanAudit: false,
    buildReviewQueue: false,
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
    } else if (arg === '--human-audit') {
      options.humanAuditPath = args[index + 1]
      index += 1
    } else if (arg === '--audit-packets') {
      options.auditPacketsPath = args[index + 1]
      index += 1
    } else if (arg === '--judge-results') {
      options.judgeResultsPath = args[index + 1]
      index += 1
    } else if (arg === '--out') {
      options.outPath = args[index + 1]
      index += 1
    } else if (arg === '--build-human-audit') {
      options.buildHumanAudit = true
    } else if (arg === '--build-review-queue') {
      options.buildReviewQueue = true
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
  npm run generation:kappa -- --archive-dir .novel/evals/run --build-human-audit
  npm run generation:kappa -- --archive-dir .novel/evals/run --build-review-queue
  npm run generation:kappa -- --archive-dir .novel/evals/run --human-audit .novel/evals/run/human-audit.tsv
  npm run generation:kappa -- --archive-dir .novel/evals/run --human-audit .novel/evals/run/review-queue.tsv
`)
}

async function main() {
  const options = parseJudgeKappaArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  if (options.buildHumanAudit) {
    const template = await buildHumanAuditTemplateFromArchive({
      archiveDir: options.archiveDir,
      auditPacketsPath: options.auditPacketsPath,
      outPath: options.outPath,
    })

    if (options.json) {
      console.log(JSON.stringify(template, null, 2))
    } else {
      console.log(
        [
          `Human audit rows: ${template.rows}`,
          `Audit packets: ${template.auditPacketsPath}`,
          `Template: ${template.humanAuditPath}`,
        ].join('\n'),
      )
    }
    return
  }

  if (options.buildReviewQueue) {
    const queue = await buildReviewQueueFromArchive({
      archiveDir: options.archiveDir,
      auditPacketsPath: options.auditPacketsPath,
      outPath: options.outPath,
    })

    if (options.json) {
      console.log(JSON.stringify(queue, null, 2))
    } else {
      console.log(
        [
          `Review queue rows: ${queue.rows}`,
          `Canonical rows: ${queue.canonicalRows}`,
          `Duplicate rows: ${queue.duplicateRows}`,
          `Audit packets: ${queue.auditPacketsPath}`,
          `Queue: ${queue.reviewQueuePath}`,
        ].join('\n'),
      )
    }
    return
  }

  const report = await computeKappaFromArchive({
    archiveDir: options.archiveDir,
    humanCsvPath: options.humanCsvPath,
    humanAuditPath: options.humanAuditPath,
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
        `Audit pass rate: ${report.auditPassRate === null ? 'not-run' : report.auditPassRate.toFixed(3)}`,
        `Duplicate consistency: ${report.duplicateConsistency === null ? 'not-run' : report.duplicateConsistency.toFixed(3)}`,
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
