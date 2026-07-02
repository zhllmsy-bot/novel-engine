import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeKappaFromArchive, parseJudgeKappaArgs } from './judge-kappa.ts'

describe('judge kappa tool', () => {
  it('parses archive-dir kappa options', () => {
    expect(
      parseJudgeKappaArgs([
        '--archive-dir',
        '.novel/evals/run',
        '--human-csv',
        'human.csv',
        '--judge-results',
        'judge.json',
        '--out',
        'kappa.json',
        '--json',
      ]),
    ).toMatchObject({
      archiveDir: '.novel/evals/run',
      humanCsvPath: 'human.csv',
      judgeResultsPath: 'judge.json',
      outPath: 'kappa.json',
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
})
