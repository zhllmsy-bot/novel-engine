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
  writeArchivedGenerationEvalArtifacts,
  type GenerationEvalReport,
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
      expect(suite.readiness).toMatchObject({
        ok: true,
        projectCount: 1,
        loadedProjects: 1,
        promptReadyProjects: 1,
        errorCount: 0,
      })
      expect(suite.archivePath).toBe(root)
      expect(output).toContain('Generation eval suite: DRY-RUN')
      expect(output).toContain('Readiness: PASS loaded 1/1')
      expect(output).toContain(
        'Paired-run gate: deferred until non-dry-run generation',
      )
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
      ).toContain('Paired-run gate: deferred until non-dry-run generation')
      expect(
        await readFile(join(root, 'generation-eval-suite.json'), 'utf8'),
      ).toContain('"readiness"')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('redacts provider endpoints and absolute paths in archived eval artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generation-eval-redaction-'))
    const repoRoot = process.cwd()
    const report = {
      rootPath: join(repoRoot, 'examples', 'long-memory-benchmark'),
      ok: false,
      dryRun: false,
      title: '青灯镜湖',
      chapterId: 'chapter-006',
      budgetChars: 1200,
      repeatCount: 1,
      provider: {
        kind: 'openai-compatible',
        baseUrl: 'https://sub.kedaya.xyz',
        model: 'gpt-5.5',
        wireApi: 'responses',
        reasoningEffort: 'xhigh',
      },
      fingerprint: {
        gitCommit: 'deadbeef',
        datasetVersion: 'dataset-v1',
        datasetHash: 'dataset-hash',
        configHash: 'config-hash',
      },
      criteria: [],
      arms: [],
      runs: [
        {
          id: 'chapter-006-repeat-1',
          chapterId: 'chapter-006',
          repeatIndex: 1,
          arms: [
            {
              id: 'four-layer',
              output: '示例输出',
              outputChars: 4,
              trace: {
                kind: 'generation',
                wireApi: 'responses',
                model: 'gpt-5.5',
                endpoint: 'https://sub.kedaya.xyz/v1/responses',
                request: {
                  systemPromptPreview: 'Bearer secret-token',
                  promptPreview: 'api sk-12345678901234567890',
                  promptChars: 20,
                  maxOutputChars: 200,
                  temperature: 0.4,
                  reasoningEffort: 'xhigh',
                  store: false,
                },
                response: {
                  responseId: 'resp_123',
                  statusCode: 200,
                  object: 'response',
                  model: 'gpt-5.5',
                  finishedStatus: 'completed',
                  usage: {
                    inputTokens: 10,
                    outputTokens: 20,
                    totalTokens: 30,
                  },
                  outputPreview: '正常输出',
                },
              },
            },
          ],
        },
      ],
      aggregate: {
        arms: [],
        comparisons: [],
      },
      judge: {
        enabled: true,
        provider: {
          kind: 'openai-compatible',
          baseUrl: 'https://sub.kedaya.xyz',
          model: 'gpt-5.5',
          wireApi: 'responses',
        },
        results: [
          {
            runId: 'chapter-006-repeat-1',
            chapterId: 'chapter-006',
            repeatIndex: 1,
            pair: 'baseline:four-layer',
            order: 'candidate-right',
            leftArm: 'baseline',
            rightArm: 'four-layer',
            choice: 'four-layer',
            rawChoice: 'B',
            reason: 'Bearer judge-secret',
            trace: {
              kind: 'judge',
              wireApi: 'responses',
              model: 'gpt-5.5',
              endpoint: 'https://sub.kedaya.xyz/v1/responses',
              request: {
                systemPromptPreview: 'judge system',
                promptPreview: 'sk-abcdefghijklmnopqrstuvwxyz123456',
                promptChars: 32,
                maxOutputChars: 200,
                temperature: 0,
                reasoningEffort: 'xhigh',
                store: false,
              },
              response: {
                statusCode: 200,
                outputPreview: 'judge output',
              },
            },
          },
        ],
        comparisons: [],
      },
      archivePath: join(
        repoRoot,
        'examples',
        'long-memory-benchmark',
        '.novel',
        'evals',
        'phase0-real-001',
      ),
      gate: {
        status: 'fail',
        ok: false,
        failedReasonIds: ['insufficient-callback-win-vs-baseline'],
      },
      errors: ['Bearer top-secret'],
    } satisfies GenerationEvalReport

    try {
      await writeArchivedGenerationEvalArtifacts({
        archiveDir: root,
        report,
      })

      const reportArchive = await readFile(
        join(root, 'generation-eval-report.json'),
        'utf8',
      )
      const summaryArchive = await readFile(
        join(root, 'generation-eval-summary.md'),
        'utf8',
      )
      const judgeArchive = await readFile(join(root, 'judge-results.json'), 'utf8')
      const traceArchive = await readFile(
        join(root, 'request-traces.json'),
        'utf8',
      )

      for (const archived of [
        reportArchive,
        summaryArchive,
        judgeArchive,
        traceArchive,
      ]) {
        expect(archived).not.toContain('sub.kedaya.xyz')
        expect(archived).not.toContain('/Users/admin/Documents/Codex')
        expect(archived).not.toContain('Bearer ')
        expect(archived).not.toContain('sk-12345678901234567890')
        expect(archived).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456')
      }

      expect(reportArchive).toContain('[REDACTED-HOST]')
      expect(traceArchive).toContain('"baseUrl": "https://[REDACTED-HOST]/"')
      expect(summaryArchive).toContain('baseUrl=https://[REDACTED-HOST]/')
      expect(reportArchive).toContain('"rootPath": "examples/long-memory-benchmark"')
      expect(reportArchive).toContain(
        '"archivePath": "examples/long-memory-benchmark/.novel/evals/phase0-real-001"',
      )
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
