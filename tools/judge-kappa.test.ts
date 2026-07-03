import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildHumanAuditTemplateFromArchive,
  buildReviewQueueFromArchive,
  computeKappaFromArchive,
  parseJudgeKappaArgs,
} from './judge-kappa.ts'

describe('judge kappa tool', () => {
  it('parses archive-dir kappa options', () => {
    expect(
      parseJudgeKappaArgs([
        '--archive-dir',
        '.novel/evals/run',
        '--human-csv',
        'human.csv',
        '--human-audit',
        'human-audit.tsv',
        '--audit-packets',
        'audit-packets.jsonl',
        '--judge-results',
        'judge.json',
        '--out',
        'kappa.json',
        '--build-human-audit',
        '--build-review-queue',
        '--json',
      ]),
    ).toMatchObject({
      archiveDir: '.novel/evals/run',
      humanCsvPath: 'human.csv',
      humanAuditPath: 'human-audit.tsv',
      auditPacketsPath: 'audit-packets.jsonl',
      judgeResultsPath: 'judge.json',
      outPath: 'kappa.json',
      buildHumanAudit: true,
      buildReviewQueue: true,
      json: true,
    })
  })

  it('reports no kappa when human pairwise labels are empty', async () => {
    const root = await mkdtemp(join(tmpdir(), 'judge-kappa-empty-'))

    try {
      await writeFile(
        join(root, 'human-pairwise-review.csv'),
        [
          '"project","case_id","run_id","chapter_id","repeat_index","pair","order","left_arm","right_arm","left_sample","right_sample","human_choice","human_notes"',
          '"P","case-a","run-1","chapter-001","1","baseline:four-layer","candidate-right","baseline","four-layer","A","B","",""',
        ].join('\n'),
      )
      await writeFile(
        join(root, 'judge-results.json'),
        JSON.stringify({
          enabled: true,
          reports: [
            {
              project: 'P',
              caseId: 'case-a',
              judge: {
                results: [
                  {
                    runId: 'run-1',
                    caseId: 'case-a',
                    pair: 'baseline:four-layer',
                    order: 'candidate-right',
                    choice: 'baseline',
                  },
                ],
              },
            },
          ],
        }),
      )

      const report = await computeKappaFromArchive({ archiveDir: root })

      expect(report).toMatchObject({
        labeledRows: 0,
        usableRows: 0,
        kappa: null,
        okToTrustJudge: false,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('computes trusted kappa when ten human labels match judge labels', async () => {
    const root = await mkdtemp(join(tmpdir(), 'judge-kappa-full-'))
    const humanRows = [
      '"project","case_id","run_id","chapter_id","repeat_index","pair","order","left_arm","right_arm","left_sample","right_sample","human_choice","human_notes"',
    ]
    const judgeResults = []

    for (let index = 1; index <= 10; index += 1) {
      const order = index % 2 === 0 ? 'candidate-left' : 'candidate-right'
      const leftArm = order === 'candidate-left' ? 'four-layer' : 'baseline'
      const rightArm = order === 'candidate-left' ? 'baseline' : 'four-layer'
      const humanChoice = order === 'candidate-left' ? 'B' : 'A'
      humanRows.push(
        [
          'P',
          'case-a',
          `run-${index}`,
          'chapter-001',
          String(index),
          'baseline:four-layer',
          order,
          leftArm,
          rightArm,
          '左样本',
          '右样本',
          humanChoice,
          '',
        ].map((value) => `"${value}"`).join(','),
      )
      judgeResults.push({
        runId: `run-${index}`,
        caseId: 'case-a',
        pair: 'baseline:four-layer',
        order,
        choice: 'baseline',
      })
    }

    try {
      await writeFile(join(root, 'human-pairwise-review.csv'), humanRows.join('\n'))
      await writeFile(
        join(root, 'judge-results.json'),
        JSON.stringify({
          enabled: true,
          reports: [
            {
              project: 'P',
              caseId: 'case-a',
              judge: {
                results: judgeResults,
              },
            },
          ],
        }),
      )

      const report = await computeKappaFromArchive({ archiveDir: root })
      const saved = JSON.parse(
        await readFile(join(root, 'kappa-report.json'), 'utf8'),
      ) as { kappa: number }

      expect(report.usableRows).toBe(10)
      expect(report.kappa).toBe(1)
      expect(report.okToTrustJudge).toBe(true)
      expect(saved.kappa).toBe(1)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('builds a spreadsheet-friendly human audit template from L0 packets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'judge-kappa-audit-template-'))

    try {
      await writeFile(
        join(root, 'audit-packets.jsonl'),
        `${JSON.stringify({
          packetId: 'run-1:baseline:four-layer:candidate-right',
          project: 'P',
          caseId: 'case-a',
          runId: 'run-1',
          chapterId: 'chapter-001',
          repeatIndex: 1,
          pair: 'baseline:four-layer',
          order: 'candidate-right',
          leftArm: 'baseline',
          rightArm: 'four-layer',
          leftSample: '左样本',
          rightSample: '右样本',
          judge: {
            choice: 'four-layer',
            rawChoice: 'B',
          },
          needles: [
            {
              criterionId: 'callback-key',
              status: 'mapped',
              codexEntries: [
                {
                  id: 'item-key',
                  name: '镜湖钥',
                  path: 'codex/items/key.md',
                  excerpt: '镜湖钥不能交给黑潮司。',
                },
              ],
            },
          ],
          needleMappingCoverage: {
            ratio: 1,
            unmappedCriterionIds: [],
          },
        })}\n`,
      )

      const report = await buildHumanAuditTemplateFromArchive({ archiveDir: root })
      const template = await readFile(join(root, 'human-audit.tsv'), 'utf8')

      expect(report).toMatchObject({
        packets: 1,
        rows: 1,
      })
      expect(template).toContain('packet_id\tproject\tcase_id')
      expect(template).toContain('human_choice\thuman_accepts_judge\thuman_notes')
      expect(template).toContain('callback-key :: mapped')
      expect(template).toContain('镜湖钥不能交给黑潮司。')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('builds a deterministic review queue with duplicate rows from L0 packets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'judge-kappa-review-queue-'))

    try {
      await writeFile(
        join(root, 'audit-packets.jsonl'),
        Array.from({ length: 10 }, (_, index) =>
          JSON.stringify(makeAuditPacket(index + 1)),
        ).join('\n'),
      )

      const report = await buildReviewQueueFromArchive({ archiveDir: root })
      const queue = await readFile(join(root, 'review-queue.tsv'), 'utf8')
      const rows = parseTestTsv(queue)
      const canonicalRows = rows.filter((row) => row.item_kind === 'canonical')
      const duplicateRows = rows.filter((row) => row.item_kind === 'duplicate')

      expect(report).toMatchObject({
        packets: 10,
        canonicalRows: 10,
        duplicateRows: 2,
        rows: 12,
      })
      expect(queue).toContain('review_item_id\titem_kind\tcanonical_packet_id')
      expect(canonicalRows).toHaveLength(10)
      expect(duplicateRows).toHaveLength(2)
      expect(
        duplicateRows.every((row) =>
          canonicalRows.some(
            (canonical) => canonical.review_item_id === row.duplicate_of,
          ),
        ),
      ).toBe(true)
      expect(new Set(canonicalRows.map((row) => row.packet_id)).size).toBe(10)
      expect(new Set(rows.map((row) => row.shown_index)).size).toBe(12)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails trust when audit pass rate is below threshold even with perfect kappa', async () => {
    const root = await mkdtemp(join(tmpdir(), 'judge-kappa-human-audit-'))
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
    const rows = [header.join('\t')]
    const judgeResults = []

    for (let index = 1; index <= 10; index += 1) {
      const order = index % 2 === 0 ? 'candidate-left' : 'candidate-right'
      const leftArm = order === 'candidate-left' ? 'four-layer' : 'baseline'
      const rightArm = order === 'candidate-left' ? 'baseline' : 'four-layer'
      const humanChoice = order === 'candidate-left' ? 'right' : 'left'
      const acceptsJudge = index <= 8 ? 'yes' : 'no'
      rows.push(
        [
          `packet-${index}`,
          'P',
          'case-a',
          `run-${index}`,
          'chapter-001',
          String(index),
          'baseline:four-layer',
          order,
          leftArm,
          rightArm,
          'baseline',
          '',
          '1.000',
          '',
          'callback-key :: mapped :: item-key | 镜湖钥',
          '左样本',
          '右样本',
          humanChoice,
          acceptsJudge,
          '',
        ].join('\t'),
      )
      judgeResults.push({
        runId: `run-${index}`,
        caseId: 'case-a',
        pair: 'baseline:four-layer',
        order,
        choice: 'baseline',
      })
    }

    try {
      await writeFile(join(root, 'human-audit.tsv'), rows.join('\n'))
      await writeFile(
        join(root, 'judge-results.json'),
        JSON.stringify({
          enabled: true,
          results: judgeResults,
        }),
      )

      const report = await computeKappaFromArchive({
        archiveDir: root,
        humanAuditPath: join(root, 'human-audit.tsv'),
      })

      expect(report.usableRows).toBe(10)
      expect(report.kappa).toBe(1)
      expect(report.auditRows).toBe(10)
      expect(report.auditAcceptedRows).toBe(8)
      expect(report.auditRejectedRows).toBe(2)
      expect(report.auditPassRate).toBe(0.8)
      expect(report.okToTrustJudge).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails trust when audit acceptance cells are blank even with perfect kappa', async () => {
    const root = await mkdtemp(join(tmpdir(), 'judge-kappa-blank-audit-'))
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
    const rows = [header.join('\t')]
    const judgeResults = []

    for (let index = 1; index <= 10; index += 1) {
      const order = index % 2 === 0 ? 'candidate-left' : 'candidate-right'
      const leftArm = order === 'candidate-left' ? 'four-layer' : 'baseline'
      const rightArm = order === 'candidate-left' ? 'baseline' : 'four-layer'
      const humanChoice = order === 'candidate-left' ? 'right' : 'left'
      rows.push(
        [
          `packet-${index}`,
          'P',
          'case-a',
          `run-${index}`,
          'chapter-001',
          String(index),
          'baseline:four-layer',
          order,
          leftArm,
          rightArm,
          'baseline',
          '',
          '1.000',
          '',
          'callback-key :: mapped :: item-key | 镜湖钥',
          '左样本',
          '右样本',
          humanChoice,
          index === 10 ? '' : 'yes',
          '',
        ].join('\t'),
      )
      judgeResults.push({
        runId: `run-${index}`,
        caseId: 'case-a',
        pair: 'baseline:four-layer',
        order,
        choice: 'baseline',
      })
    }

    try {
      await writeFile(join(root, 'human-audit.tsv'), rows.join('\n'))
      await writeFile(
        join(root, 'judge-results.json'),
        JSON.stringify({
          enabled: true,
          results: judgeResults,
        }),
      )

      const report = await computeKappaFromArchive({
        archiveDir: root,
        humanAuditPath: join(root, 'human-audit.tsv'),
      })

      expect(report.usableRows).toBe(10)
      expect(report.kappa).toBe(1)
      expect(report.auditAcceptedRows).toBe(9)
      expect(report.auditBlankAcceptRows).toBe(1)
      expect(report.auditPassRate).toBe(1)
      expect(report.okToTrustJudge).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('scores only canonical review queue rows and trusts consistent duplicates', async () => {
    const root = await mkdtemp(join(tmpdir(), 'judge-kappa-consistent-dupes-'))

    try {
      const { rows, judgeResults } = makeFilledReviewQueueRows({
        duplicateChoices: ['left', 'right'],
      })
      await writeFile(join(root, 'review-queue.tsv'), rows.join('\n'))
      await writeFile(
        join(root, 'judge-results.json'),
        JSON.stringify({ enabled: true, results: judgeResults }),
      )

      const report = await computeKappaFromArchive({
        archiveDir: root,
        humanAuditPath: join(root, 'review-queue.tsv'),
      })

      expect(report.auditRows).toBe(12)
      expect(report.usableRows).toBe(10)
      expect(report.kappa).toBe(1)
      expect(report.duplicateRows).toBe(2)
      expect(report.duplicatePairs).toBe(2)
      expect(report.duplicateConsistent).toBe(2)
      expect(report.duplicateConsistency).toBe(1)
      expect(report.okToTrustJudge).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails trust when duplicate review rows disagree with their canonical rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'judge-kappa-inconsistent-dupes-'))

    try {
      const { rows, judgeResults } = makeFilledReviewQueueRows({
        duplicateChoices: ['right', 'right'],
      })
      await writeFile(join(root, 'review-queue.tsv'), rows.join('\n'))
      await writeFile(
        join(root, 'judge-results.json'),
        JSON.stringify({ enabled: true, results: judgeResults }),
      )

      const report = await computeKappaFromArchive({
        archiveDir: root,
        humanAuditPath: join(root, 'review-queue.tsv'),
      })

      expect(report.usableRows).toBe(10)
      expect(report.kappa).toBe(1)
      expect(report.duplicateRows).toBe(2)
      expect(report.duplicatePairs).toBe(2)
      expect(report.duplicateConsistent).toBe(1)
      expect(report.duplicateConsistency).toBe(0.5)
      expect(report.okToTrustJudge).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

function makeAuditPacket(index: number) {
  return {
    packetId: `packet-${index}`,
    project: 'P',
    caseId: 'case-a',
    runId: `run-${index}`,
    chapterId: 'chapter-001',
    repeatIndex: index,
    pair: 'baseline:four-layer',
    order: index % 2 === 0 ? 'candidate-left' : 'candidate-right',
    leftArm: index % 2 === 0 ? 'four-layer' : 'baseline',
    rightArm: index % 2 === 0 ? 'baseline' : 'four-layer',
    leftSample: `左样本 ${index}`,
    rightSample: `右样本 ${index}`,
    judge: {
      choice: 'baseline',
      rawChoice: index % 2 === 0 ? 'B' : 'A',
    },
    needles: [
      {
        criterionId: 'callback-key',
        status: 'mapped',
        codexEntries: [
          {
            id: 'item-key',
            name: '镜湖钥',
            path: 'codex/items/key.md',
            excerpt: '镜湖钥不能交给黑潮司。',
          },
        ],
      },
    ],
    needleMappingCoverage: {
      ratio: 1,
      unmappedCriterionIds: [],
    },
  }
}

function parseTestTsv(source: string) {
  const [headerLine = '', ...bodyLines] = source.trim().split(/\r?\n/)
  const header = headerLine.split('\t')
  return bodyLines.map((line) =>
    Object.fromEntries(
      line.split('\t').map((cell, index) => [header[index], cell]),
    ),
  )
}

function makeFilledReviewQueueRows(input: { duplicateChoices: [string, string] | string[] }) {
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
  const rows = [header.join('\t')]
  const judgeResults = []

  for (let index = 1; index <= 10; index += 1) {
    const order = index % 2 === 0 ? 'candidate-left' : 'candidate-right'
    const leftArm = order === 'candidate-left' ? 'four-layer' : 'baseline'
    const rightArm = order === 'candidate-left' ? 'baseline' : 'four-layer'
    const humanChoice = order === 'candidate-left' ? 'right' : 'left'
    rows.push(
      [
        `review-${index}`,
        'canonical',
        `packet-${index}`,
        '',
        '',
        String(index),
        '',
        '',
        '',
        `packet-${index}`,
        'P',
        'case-a',
        `run-${index}`,
        'chapter-001',
        String(index),
        'baseline:four-layer',
        order,
        leftArm,
        rightArm,
        'baseline',
        '',
        '1.000',
        '',
        'callback-key :: mapped :: item-key | 镜湖钥',
        '左样本',
        '右样本',
        humanChoice,
        'yes',
        '',
      ].join('\t'),
    )
    judgeResults.push({
      runId: `run-${index}`,
      caseId: 'case-a',
      pair: 'baseline:four-layer',
      order,
      choice: 'baseline',
    })
  }

  const duplicateSpecs = [
    { source: 1, choice: input.duplicateChoices[0] },
    { source: 2, choice: input.duplicateChoices[1] },
  ]
  for (const [index, spec] of duplicateSpecs.entries()) {
    const source = spec.source
    const order = source % 2 === 0 ? 'candidate-left' : 'candidate-right'
    const leftArm = order === 'candidate-left' ? 'four-layer' : 'baseline'
    const rightArm = order === 'candidate-left' ? 'baseline' : 'four-layer'
    rows.push(
      [
        `review-${source}-dup`,
        'duplicate',
        `packet-${source}`,
        '',
        `review-${source}`,
        String(11 + index),
        '',
        '',
        '',
        `packet-${source}`,
        'P',
        'case-a',
        `run-${source}`,
        'chapter-001',
        String(source),
        'baseline:four-layer',
        order,
        leftArm,
        rightArm,
        'baseline',
        '',
        '1.000',
        '',
        'callback-key :: mapped :: item-key | 镜湖钥',
        '左样本',
        '右样本',
        spec.choice,
        'yes',
        '',
      ].join('\t'),
    )
  }

  return { rows, judgeResults }
}
