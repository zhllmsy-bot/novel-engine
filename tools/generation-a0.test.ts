import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  compareA0Archives,
  formatA0Report,
  parseGenerationA0Args,
} from './generation-a0.ts'
import type { GenerationEvalReport } from './generation-eval.ts'
import type { GenerationEvalScore } from '../src/eval/generationCriteria.ts'

describe('generation A0 comparator', () => {
  it('parses local and fixture archive options', () => {
    expect(
      parseGenerationA0Args([
        '--local-archive',
        '.novel/evals/a0-local',
        '--fixture-archive',
        '.novel/evals/a0-fixture',
        '--out',
        '.novel/evals/a0-report.json',
        '--json',
      ]),
    ).toMatchObject({
      localArchive: '.novel/evals/a0-local',
      fixtureArchive: '.novel/evals/a0-fixture',
      outPath: '.novel/evals/a0-report.json',
      json: true,
    })
  })

  it('passes when deterministic callback delta clears the pre-registered gate', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generation-a0-pass-'))
    const localArchive = join(root, 'local')
    const fixtureArchive = join(root, 'fixture')
    const outPath = join(root, 'a0-report.json')

    try {
      await writeArchive(localArchive, buildReport({
        l1Mode: 'local',
        runCount: 10,
        fourLayerCallbackHits: 0,
        recentFillCallbackHits: 1,
      }))
      await writeArchive(fixtureArchive, buildReport({
        l1Mode: 'causal-fixture',
        runCount: 10,
        fourLayerCallbackHits: 1,
        recentFillCallbackHits: 0,
        judgeChoice: 'recent-fill',
      }))

      const report = await compareA0Archives({
        localArchive,
        fixtureArchive,
        outPath,
      })
      const saved = JSON.parse(await readFile(outPath, 'utf8')) as {
        status: string
        judgeUse: string
      }

      expect(report.ok).toBe(true)
      expect(report.status).toBe('pass')
      expect(report.judgeUse).toBe('excluded-uncalibrated')
      expect(report.aggregate.callbackWinRateDelta).toBe(1)
      expect(report.aggregate.fixture.callbackWilson95.lower).toBeGreaterThan(0.5)
      expect(report.failedReasonIds).toEqual([])
      expect(saved).toMatchObject({
        status: 'pass',
        judgeUse: 'excluded-uncalibrated',
      })
      expect(formatA0Report(report)).toContain('Judge: excluded-uncalibrated')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('marks strong-looking small samples underpowered by Wilson lower bound', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generation-a0-underpowered-'))
    const localArchive = join(root, 'local')
    const fixtureArchive = join(root, 'fixture')

    try {
      await writeArchive(localArchive, buildReport({
        l1Mode: 'local',
        runCount: 3,
        fourLayerCallbackHits: 0,
        recentFillCallbackHits: 1,
      }))
      await writeArchive(fixtureArchive, buildReport({
        l1Mode: 'causal-fixture',
        runCount: 3,
        fourLayerCallbackHits: 1,
        recentFillCallbackHits: 0,
      }))

      const report = await compareA0Archives({
        localArchive,
        fixtureArchive,
      })

      expect(report.ok).toBe(false)
      expect(report.status).toBe('underpowered')
      expect(report.aggregate.callbackWinRateDelta).toBe(1)
      expect(report.aggregate.fixture.callbackWilson95.lower).toBeLessThanOrEqual(0.5)
      expect(report.failedReasonIds).toContain(
        'underpowered-callback-wilson-lower-bound',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

async function writeArchive(path: string, report: GenerationEvalReport) {
  await mkdir(path, { recursive: true })
  await writeFile(
    join(path, 'generation-eval-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
}

function buildReport(input: {
  l1Mode: 'local' | 'causal-fixture'
  runCount: number
  fourLayerCallbackHits: number
  recentFillCallbackHits: number
  judgeChoice?: 'four-layer' | 'recent-fill'
}): GenerationEvalReport {
  return {
    rootPath: '/tmp/a0-project',
    ok: true,
    dryRun: false,
    a0: {
      l1Mode: input.l1Mode,
      l1FixturePath:
        input.l1Mode === 'causal-fixture'
          ? 'meta/l1-ablation-summaries.json'
          : undefined,
      l1FixtureHash:
        input.l1Mode === 'causal-fixture' ? '1234567890abcdef' : undefined,
      metricVersion: 'a0-deterministic-v1',
      primaryMetric: 'callback-structural-win-rate',
      judgeUse: 'exploratory-only',
    },
    title: 'A0 测试书',
    caseId: 'case-a',
    chapterId: 'chapter-010',
    budgetChars: 900,
    repeatCount: input.runCount,
    provider: {
      kind: 'openai-compatible',
      baseUrl: 'https://provider.test',
      model: 'test-model',
      wireApi: 'responses',
    },
    fingerprint: {
      gitCommit: 'test',
      datasetVersion: 'dataset',
      datasetHash: 'dataset-hash',
      configHash: 'config-hash',
    },
    criteria: [],
    arms: [],
    runs: Array.from({ length: input.runCount }, (_, index) => ({
      id: `run-${index + 1}`,
      caseId: 'case-a',
      chapterId: 'chapter-010',
      repeatIndex: index + 1,
      arms: [
        {
          id: 'recent-fill',
          score: score({
            callbackHits: input.recentFillCallbackHits,
            settingViolations: 0,
            futureLeaks: 0,
          }),
        },
        {
          id: 'four-layer',
          score: score({
            callbackHits: input.fourLayerCallbackHits,
            settingViolations: 0,
            futureLeaks: 0,
          }),
        },
      ],
    })),
    aggregate: {
      arms: [],
      comparisons: [],
    },
    judge: input.judgeChoice
      ? {
          enabled: true,
          results: [
            {
              runId: 'run-1',
              caseId: 'case-a',
              chapterId: 'chapter-010',
              repeatIndex: 1,
              pair: 'recent-fill:four-layer',
              order: 'candidate-right',
              leftArm: 'recent-fill',
              rightArm: 'four-layer',
              choice: input.judgeChoice,
              rawChoice: input.judgeChoice === 'four-layer' ? 'B' : 'A',
              reason: 'uncalibrated judge must not affect A0',
            },
          ],
          comparisons: [
            {
              baseline: 'recent-fill',
              pairedReviews: 1,
              fourLayerWins: input.judgeChoice === 'four-layer' ? 1 : 0,
              baselineWins: input.judgeChoice === 'recent-fill' ? 1 : 0,
              ties: 0,
              invalid: 0,
              fourLayerWinRate: input.judgeChoice === 'four-layer' ? 1 : 0,
            },
          ],
        }
      : undefined,
    gate: {
      status: 'pass',
      ok: true,
      failedReasonIds: [],
    },
    errors: [],
  }
}

function score(input: {
  callbackHits: number
  settingViolations: number
  futureLeaks: number
}): GenerationEvalScore {
  return {
    criteria: 3,
    passed: 3 - input.settingViolations - input.futureLeaks,
    failed: input.settingViolations + input.futureLeaks,
    callbackExpectations: 1,
    callbackHits: input.callbackHits,
    settingExpectations: 1,
    settingViolations: input.settingViolations,
    futureLeakChecks: 1,
    futureLeaks: input.futureLeaks,
    results: [],
  }
}
