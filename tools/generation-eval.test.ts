import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  evaluateGeneration,
  evaluateGenerationSuite,
  formatGenerationEvalReport,
  formatGenerationEvalSuiteReport,
  parseGenerationEvalArgs,
} from './generation-eval.ts'
import { scoreGenerationOutput } from '../src/eval/generationCriteria.ts'

describe('generation eval tool', () => {
  it('parses dry-run generation eval options', () => {
    expect(
      parseGenerationEvalArgs([
        '--dry-run',
        '--show-prompts',
        '--repeat',
        '5',
        '--archive-dir',
        '.novel/evals/test',
        '--model',
        'test-model',
        '--wire-api',
        'responses',
        '--judge',
        '--judge-model',
        'judge-model',
        '--judge-wire-api',
        'responses',
        '--reasoning-effort',
        'xhigh',
        '--benchmark-project',
        'examples/long-memory-benchmark',
        'examples/long-memory-benchmark',
      ]),
    ).toMatchObject({
      rootPath: 'examples/long-memory-benchmark',
      benchmarkProjects: ['examples/long-memory-benchmark'],
      dryRun: true,
      showPrompts: true,
      repeatCount: 5,
      archiveDir: '.novel/evals/test',
      model: 'test-model',
      wireApi: 'responses',
      judge: true,
      judgeModel: 'judge-model',
      judgeWireApi: 'responses',
      reasoningEffort: 'xhigh',
    })
  })

  it('builds baseline and four-layer prompts for the long benchmark', async () => {
    const report = await evaluateGeneration({
      rootPath: 'examples/long-memory-benchmark',
      dryRun: true,
      includePrompts: true,
    })
    const output = formatGenerationEvalReport(report)
    const baseline = report.arms.find((arm) => arm.id === 'baseline')
    const recentFill = report.arms.find((arm) => arm.id === 'recent-fill')
    const fourLayer = report.arms.find((arm) => arm.id === 'four-layer')

    expect(report.ok).toBe(true)
    expect(report.dryRun).toBe(true)
    expect(report.fingerprint.datasetHash).not.toBe('unknown')
    expect(report.fingerprint.configHash).not.toBe('unknown')
    expect(report.chapterId).toBe('chapter-006')
    expect(report.criteria.map((criterion) => criterion.id)).toEqual([
      'callback-oath',
      'setting-key-rule',
      'setting-jianli-identity',
      'no-future-answer',
    ])
    expect(baseline).toMatchObject({
      id: 'baseline',
      memoryCount: 1,
    })
    expect(recentFill).toMatchObject({
      id: 'recent-fill',
      memoryCount: 1,
    })
    expect(recentFill?.promptChars).toBeGreaterThanOrEqual(
      baseline?.promptChars || 0,
    )
    expect(fourLayer?.memoryCount).toBeGreaterThan(1)
    expect(fourLayer?.structureMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'setting_recall' }),
        expect.objectContaining({ id: 'foreshadow_coverage' }),
      ]),
    )
    expect(baseline?.prompt).toContain('第006章 镜湖重逢')
    expect(baseline?.prompt).not.toContain('灯灭之前')
    expect(fourLayer?.prompt).toContain('灯灭之前')
    expect(fourLayer?.memorySources).toContain('recall:chapter_summary:chapter-001')
    expect(output).toContain('Generation eval: DRY-RUN')
    expect(output).toContain('Repeats: 3')
    expect(output).toContain('Criteria: 4 total')
    expect(output).toContain('Gate: NOT-RUN')
  })

  it('archives dry-run prompts for reproducible review', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generation-eval-'))

    try {
      const report = await evaluateGeneration({
        rootPath: 'examples/long-memory-benchmark',
        dryRun: true,
        includePrompts: true,
        archiveDir: root,
      })

      expect(report.ok).toBe(true)
      expect(report.archivePath).toBe(root)
      await expect(stat(join(root, 'generation-eval-report.json'))).resolves.toBeTruthy()
      await expect(stat(join(root, 'generation-eval-summary.md'))).resolves.toBeTruthy()
      await expect(stat(join(root, 'human-review.csv'))).resolves.toBeTruthy()
      await expect(
        stat(join(root, 'judge-review-prompts.jsonl')),
      ).resolves.toBeTruthy()
      await expect(stat(join(root, 'judge-results.json'))).resolves.toBeTruthy()
      await expect(stat(join(root, 'request-traces.json'))).resolves.toBeTruthy()
      expect(
        await readFile(join(root, 'generation-eval-summary.md'), 'utf8'),
      ).toContain('Generation Eval Summary')
      expect(await readFile(join(root, 'human-review.csv'), 'utf8')).toContain(
        'review_preference',
      )
      expect(await readFile(join(root, 'judge-results.json'), 'utf8')).toContain(
        '"enabled": false',
      )
      const traceArchive = await readFile(
        join(root, 'request-traces.json'),
        'utf8',
      )
      expect(traceArchive).toContain('"runs"')
      expect(traceArchive).not.toContain('Bearer ')
      expect(traceArchive).not.toContain('sk-')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('archives dry-run suites for cross-project review', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generation-eval-suite-'))

    try {
      const suite = await evaluateGenerationSuite({
        rootPaths: ['examples/long-memory-benchmark'],
        dryRun: true,
        includePrompts: true,
        archiveDir: root,
      })
      const output = formatGenerationEvalSuiteReport(suite)

      expect(suite.ok).toBe(true)
      expect(suite.projectCount).toBe(1)
      expect(suite.archivePath).toBe(root)
      expect(output).toContain('Generation eval suite: DRY-RUN')
      await expect(stat(join(root, 'generation-eval-suite.json'))).resolves.toBeTruthy()
      await expect(
        stat(join(root, 'generation-eval-suite-summary.md')),
      ).resolves.toBeTruthy()
      await expect(stat(join(root, 'human-review.csv'))).resolves.toBeTruthy()
      await expect(
        stat(join(root, 'judge-review-prompts.jsonl')),
      ).resolves.toBeTruthy()
      await expect(stat(join(root, 'judge-results.json'))).resolves.toBeTruthy()
      await expect(stat(join(root, 'request-traces.json'))).resolves.toBeTruthy()
      await expect(
        stat(
          join(
            root,
            'long-memory-benchmark',
            'generation-eval-report.json',
          ),
        ),
      ).resolves.toBeTruthy()
      expect(
        await readFile(join(root, 'generation-eval-suite-summary.md'), 'utf8'),
      ).toContain('Generation Eval Suite Summary')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('scores generated text with callback, setting, and future leak criteria', async () => {
    const config = JSON.parse(
      await readFile(
        join(
          process.cwd(),
          'examples',
          'long-memory-benchmark',
          'meta',
          'generation-eval.json',
        ),
        'utf8',
      ),
    ) as {
      criteria: Array<{
        id: string
        description: string
        category: 'callback' | 'setting' | 'future_leak'
        contains?: string[]
        contains_any?: string[]
        not_contains?: string[]
      }>
    }
    const criteria = config.criteria.map((criterion) => ({
      id: criterion.id,
      description: criterion.description,
      category: criterion.category,
      contains: criterion.contains,
      containsAny: criterion.contains_any,
      notContains: criterion.not_contains,
    }))
    const good = scoreGenerationOutput(
      '沈泊望着简璃，说：“灯灭之前，我会回来。”他把镜湖钥握在掌心，没有交给黑潮司。简璃这个守灯人终于点头。',
      criteria,
    )
    const bad = scoreGenerationOutput(
      '沈泊把镜湖钥交给黑潮司，低声说未来答案是旧封印松动。',
      criteria,
    )

    expect(good).toMatchObject({
      callbackHits: 1,
      settingViolations: 0,
      futureLeaks: 0,
      passed: 4,
    })
    expect(bad.callbackHits).toBe(0)
    expect(bad.settingViolations).toBe(2)
    expect(bad.futureLeaks).toBe(1)
  })
})
