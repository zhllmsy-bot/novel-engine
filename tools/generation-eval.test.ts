import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  evaluateGeneration,
  formatGenerationEvalReport,
  parseGenerationEvalArgs,
  scoreGenerationOutput,
} from './generation-eval.ts'

describe('generation eval tool', () => {
  it('parses dry-run generation eval options', () => {
    expect(
      parseGenerationEvalArgs([
        '--dry-run',
        '--show-prompts',
        '--model',
        'test-model',
        'examples/long-memory-benchmark',
      ]),
    ).toMatchObject({
      rootPath: 'examples/long-memory-benchmark',
      dryRun: true,
      showPrompts: true,
      model: 'test-model',
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
    const fourLayer = report.arms.find((arm) => arm.id === 'four-layer')

    expect(report.ok).toBe(true)
    expect(report.dryRun).toBe(true)
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
    expect(fourLayer?.memoryCount).toBeGreaterThan(1)
    expect(baseline?.prompt).toContain('第006章 镜湖重逢')
    expect(baseline?.prompt).not.toContain('灯灭之前')
    expect(fourLayer?.prompt).toContain('灯灭之前')
    expect(fourLayer?.memorySources).toContain('recall:chapter_summary:chapter-001')
    expect(output).toContain('Generation eval: DRY-RUN')
    expect(output).toContain('Criteria: 4 total')
    expect(output).toContain('Gate: NOT-RUN')
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
