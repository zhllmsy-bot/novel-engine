import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  evaluateNarrativeMemory,
  formatMemoryEvalReport,
} from './memory-eval.ts'

async function writeMemoryProject(root: string) {
  await mkdir(join(root, 'meta'), { recursive: true })
  await mkdir(join(root, 'manuscript'), { recursive: true })
  await mkdir(join(root, 'codex', 'characters'), { recursive: true })
  await writeFile(
    join(root, 'meta', 'project.json'),
    JSON.stringify({
      title: '测试长篇',
      source_of_truth: 'markdown',
      chapters: [
        {
          id: 'chapter-001',
          title: '第001章 山门雨',
          path: 'manuscript/chapter-001.md',
          order: 1,
        },
      ],
    }),
  )
  await writeFile(
    join(root, 'manuscript', 'chapter-001.md'),
    '# 第001章 山门雨\n\n沈微在山门前听见玄铁剑低鸣。\n\n李长老问起他的师父。',
  )
  await writeFile(
    join(root, 'codex', 'characters', 'li.md'),
    `---
name: 李长老
keywords: [李长老, 玄铁剑]
---

李长老是玄天宗戒律堂长老。

## 当前状态

- 修为: 金丹期
`,
  )
}

describe('memory eval tool', () => {
  it('passes the deterministic four-layer recall expectations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)

      const report = await evaluateNarrativeMemory({ rootPath: root })
      const output = formatMemoryEvalReport(report)

      expect(report.ok).toBe(true)
      expect(report.stats).toMatchObject({
        expectations: 4,
        passed: 4,
        failed: 0,
        policyChecks: 12,
        policyPassed: 12,
        policyFailed: 0,
        baselinePassed: 1,
        fourLayerPassed: 4,
      })
      expect(report.comparison).toMatchObject({
        baselinePassed: 1,
        fourLayerPassed: 4,
        minimumGain: 1,
        gainedExpectationIds: [
          'l0-codex-fact',
          'l3-recall-audit',
          'l1-plot-thread',
        ],
        lostExpectationIds: [],
      })
      expect(
        report.sourceSummary.map((summary) => ({
          family: summary.family,
          label: summary.label,
          memoryCount: summary.memoryCount,
          sourceCount: summary.sourceCount,
        })),
      ).toEqual([
        {
          family: 'manuscript',
          label: '正文',
          memoryCount: 1,
          sourceCount: 1,
        },
        {
          family: 'codex',
          label: '设定',
          memoryCount: 1,
          sourceCount: 1,
        },
        {
          family: 'project',
          label: '项目',
          memoryCount: 1,
          sourceCount: 1,
        },
        {
          family: 'chapter_summary',
          label: '章摘要',
          memoryCount: 1,
          sourceCount: 1,
        },
      ])
      expect(
        report.cases.map((result) => ({
          id: result.id,
          baselineOk: result.baselineOk,
          delta: result.delta,
        })),
      ).toEqual([
        { id: 'l2-current-prose', baselineOk: true, delta: 'kept' },
        { id: 'l0-codex-fact', baselineOk: false, delta: 'gained' },
        { id: 'l3-recall-audit', baselineOk: false, delta: 'gained' },
        { id: 'l1-plot-thread', baselineOk: false, delta: 'gained' },
      ])
      expect(
        report.cases.find((result) => result.id === 'l0-codex-fact')
          ?.matchedSources,
      ).toEqual(['codex/characters/li.md'])
      expect(
        report.cases.find((result) => result.id === 'l1-plot-thread')
          ?.matchedSources,
      ).toEqual(['chapter_summary:chapter-001'])
      expect(
        report.cases.find((result) => result.id === 'l3-recall-audit')
          ?.matchedSources,
      ).toEqual(['meta/project.json'])
      expect(report.plan?.memories.map((memory) => memory.layer)).toEqual([
        'L2 风格',
        'L0 事实',
        'L3 意图',
        'L1 剧情',
      ])
      expect(output).toContain('Memory eval: OK')
      expect(output).toContain('Sources: 正文:1/1')
      expect(output).toContain('设定:1/1')
      expect(output).toContain('项目:1/1')
      expect(output).toContain('章摘要:1/1')
      expect(output).toContain('Layer L2 风格:')
      expect(output).toContain('target 40-50%')
      expect(output).toContain('Baseline: 1/4 passed')
      expect(output).toContain(
        'Four-layer gain: +3 (l0-codex-fact, l3-recall-audit, l1-plot-thread)',
      )
      expect(output).toContain('Policy: 12/12 passed')
      expect(output).toContain('KEEP l2-current-prose (L2 风格)')
      expect(output).toContain(
        'GAIN l0-codex-fact (L0 事实) sources=codex/characters/li.md',
      )
      expect(output).toContain('GAIN l3-recall-audit (L3 意图)')
      expect(output).toContain(
        'GAIN l1-plot-thread (L1 剧情) sources=chapter_summary:chapter-001',
      )
      expect(report.policyChecks.map((result) => result.id)).toEqual([
        'four-layer-not-worse-than-baseline',
        'four-layer-gains-non-l2-recall',
        'declared-layer-order',
        'selected-memory-order',
        'tight-budget-keeps-l2',
        'tight-budget-drops-l1-before-l2',
        'l3-recall-items-visible',
        'future-summary-time-sliced',
        'future-volume-summary-time-sliced',
        'future-state-time-sliced',
        'future-plot-resolution-time-sliced',
        'unknown-current-order-current-only',
      ])
      for (const policyId of [
        'future-summary-time-sliced',
        'future-volume-summary-time-sliced',
        'future-state-time-sliced',
        'future-plot-resolution-time-sliced',
      ]) {
        expect(
          report.policyChecks.find((result) => result.id === policyId),
        ).toMatchObject({
          ok: true,
          evidence: 'leaked=none',
        })
      }
      expect(
        report.policyChecks.find(
          (result) => result.id === 'unknown-current-order-current-only',
        ),
      ).toMatchObject({
        ok: true,
        evidence: 'current-only=yes',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not require four-layer gain when expectations only target recent prose', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)

      const report = await evaluateNarrativeMemory({
        rootPath: root,
        expectations: [
          {
            id: 'l2-only',
            description: 'Recent prose should appear in both plans.',
            layer: 'L2 风格',
            contains: ['当前章节原文', '玄铁剑'],
          },
        ],
      })

      expect(report.ok).toBe(true)
      expect(report.comparison).toMatchObject({
        baselinePassed: 1,
        fourLayerPassed: 1,
        minimumGain: 0,
        gainedExpectationIds: [],
        lostExpectationIds: [],
      })
      expect(
        report.policyChecks.find(
          (result) => result.id === 'four-layer-gains-non-l2-recall',
        ),
      ).toMatchObject({
        ok: true,
        evidence: 'gained=not-applicable',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not require L3 recall items from unknown-order summaries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await mkdir(join(root, 'meta'), { recursive: true })
      await mkdir(join(root, 'manuscript'), { recursive: true })
      await mkdir(join(root, 'codex', 'characters'), { recursive: true })
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: '未知顺序摘要测试',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-002',
              title: '第002章 石阶问心',
              path: 'manuscript/chapter-002.md',
              order: 2,
            },
          ],
        }),
      )
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          chapter_id: 'chapter-002',
          expectations: [
            {
              id: 'l2-only',
              description: 'Recent prose is enough for this policy probe.',
              layer: 'L2 风格',
              contains: ['当前章节原文', '玄铁剑'],
            },
          ],
        }),
      )
      await writeFile(
        join(root, 'manuscript', 'chapter-002.md'),
        '# 第002章 石阶问心\n\n沈微再次握住玄铁剑。',
      )
      await writeFile(
        join(root, 'manuscript', 'chapter-009.md'),
        '# 第009章 旧封印\n\n未来答案: 玄铁剑裂纹来自旧封印松动。',
      )
      await writeFile(
        join(root, 'codex', 'characters', 'li.md'),
        `---
name: 李长老
keywords: [玄铁剑]
---

李长老知道玄铁剑的来历。
`,
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })

      expect(report.ok).toBe(true)
      expect(
        report.policyChecks.find(
          (result) => result.id === 'l3-recall-items-visible',
        ),
      ).toMatchObject({
        ok: true,
        evidence: 'recall=not-applicable',
      })
      expect(report.plan?.memories.map((memory) => memory.body).join('\n')).not.toContain(
        '未来答案',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('uses project-local memory-eval expectations when present', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          chapter_id: 'chapter-001',
          budget_chars: 240,
          minimum_gain: 1,
          expectations: [
            {
              id: 'custom-l3-keyword',
              description: 'Project config can assert custom recall requirements.',
              layer: 'L3 意图',
              contains: ['玄铁剑'],
            },
          ],
        }),
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })

      expect(report.ok).toBe(true)
      expect(report.budgetChars).toBe(240)
      expect(report.comparison.minimumGain).toBe(1)
      expect(report.stats.expectations).toBe(1)
      expect(report.cases[0]).toMatchObject({
        id: 'custom-l3-keyword',
        ok: true,
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('supports negative memory eval expectations to guard against leaked context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          chapter_id: 'chapter-001',
          budget_chars: 900,
          expectations: [
            {
              id: 'no-future-answer',
              description: 'Project config can assert context that must stay absent.',
              layer: 'L1 剧情',
              contains: ['第001章 山门雨'],
              not_contains: ['未来答案'],
            },
          ],
        }),
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })
      const output = formatMemoryEvalReport(report)

      expect(report.ok).toBe(true)
      expect(report.cases[0]).toMatchObject({
        id: 'no-future-answer',
        ok: true,
        forbidden: [],
        notContains: ['未来答案'],
      })
      expect(output).toContain('GAIN no-future-answer (L1 剧情)')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('can require matched memory to come from a specific source family', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          chapter_id: 'chapter-001',
          budget_chars: 900,
          expectations: [
            {
              id: 'source-family-required',
              description: 'Project config can require concrete memory evidence.',
              layer: 'L0 事实',
              contains: ['李长老', '金丹期'],
              source_contains: ['codex/characters/'],
            },
          ],
        }),
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })
      const output = formatMemoryEvalReport(report)

      expect(report.ok).toBe(true)
      expect(report.cases[0]).toMatchObject({
        id: 'source-family-required',
        ok: true,
        sourceContains: ['codex/characters/'],
        missingSources: [],
        matchedSources: ['codex/characters/li.md'],
      })
      expect(output).toContain(
        'GAIN source-family-required (L0 事实) sources=codex/characters/li.md',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when a source requirement is not satisfied by matched memory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          chapter_id: 'chapter-001',
          budget_chars: 900,
          expectations: [
            {
              id: 'source-family-missing',
              description: 'Matched text from the wrong source should fail.',
              layer: 'L0 事实',
              contains: ['李长老', '金丹期'],
              source_contains: ['recall:chapter_summary:'],
            },
          ],
        }),
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })
      const output = formatMemoryEvalReport(report)

      expect(report.ok).toBe(false)
      expect(report.cases[0]).toMatchObject({
        id: 'source-family-missing',
        ok: false,
        missing: [],
        forbidden: [],
        missingSources: ['recall:chapter_summary:'],
        matchedSources: ['codex/characters/li.md'],
      })
      expect(output).toContain(
        'MISS source-family-missing (L0 事实): missing sources recall:chapter_summary: sources=codex/characters/li.md',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when a negative memory eval expectation is present in selected memory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          chapter_id: 'chapter-001',
          budget_chars: 900,
          expectations: [
            {
              id: 'forbid-current-token',
              description: 'Forbidden terms should fail the eval when selected.',
              layer: 'L2 风格',
              contains: ['当前章节原文'],
              not_contains: ['玄铁剑'],
            },
          ],
        }),
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })
      const output = formatMemoryEvalReport(report)

      expect(report.ok).toBe(false)
      expect(report.cases[0]).toMatchObject({
        id: 'forbid-current-token',
        ok: false,
        missing: [],
        forbidden: ['玄铁剑'],
        baselineOk: false,
        delta: 'missed',
      })
      expect(output).toContain(
        'MISS forbid-current-token (L2 风格): forbidden 玄铁剑',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails policy when project-local minimum gain is not reached', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          chapter_id: 'chapter-001',
          budget_chars: 900,
          minimum_gain: 2,
          expectations: [
            {
              id: 'custom-l3-keyword',
              description: 'Only one non-L2 gain is available.',
              layer: 'L3 意图',
              contains: ['玄铁剑'],
            },
          ],
        }),
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })

      expect(report.ok).toBe(false)
      expect(report.comparison.minimumGain).toBe(2)
      expect(report.comparison.gainedExpectationIds).toEqual([
        'custom-l3-keyword',
      ])
      expect(
        report.policyChecks.find(
          (result) => result.id === 'four-layer-gains-non-l2-recall',
        ),
      ).toMatchObject({
        ok: false,
        evidence: 'required=2, gained=custom-l3-keyword',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails loudly when project-local memory-eval config is invalid', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          extra_field: true,
          minimum_gain: -1,
          expectations: [
            {
              id: 'Broken ID',
              description: 'Invalid expectation should not be ignored.',
              layer: 'L4 幻觉',
              note: 'unknown fields should fail',
              contains: [],
              not_contains: ['valid', ''],
              source_contains: ['valid', ''],
            },
          ],
        }),
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })
      const output = formatMemoryEvalReport(report)

      expect(report.ok).toBe(false)
      expect(report.errors).toContain(
        'meta/memory-eval.json unknown field: extra_field.',
      )
      expect(report.errors).toContain(
        'meta/memory-eval.json expectations[0] unknown field: note.',
      )
      expect(report.errors).toContain(
        'meta/memory-eval.json expectations[0] id must match /^[a-z0-9][a-z0-9_.-]*$/.',
      )
      expect(report.errors).toContain(
        'meta/memory-eval.json expectations[0] layer must be one of: L0 事实, L1 剧情, L2 风格, L3 意图.',
      )
      expect(report.errors).toContain(
        'meta/memory-eval.json expectations[0] contains must be a non-empty string array.',
      )
      expect(report.errors).toContain(
        'meta/memory-eval.json expectations[0] not_contains must only include non-empty strings.',
      )
      expect(report.errors).toContain(
        'meta/memory-eval.json expectations[0] source_contains must only include non-empty strings.',
      )
      expect(report.errors).toContain(
        'meta/memory-eval.json minimum_gain must be a non-negative integer.',
      )
      expect(report.sourceSummary.map((summary) => summary.family)).toEqual([
        'manuscript',
        'codex',
        'project',
        'chapter_summary',
      ])
      expect(output).toContain('ERROR meta/memory-eval.json expectations[0]')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when expected codex recall is absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'memory-eval-'))

    try {
      await writeMemoryProject(root)
      await writeFile(
        join(root, 'codex', 'characters', 'li.md'),
        `---
name: 路人甲
keywords: [路人甲]
---

没有相关设定。
`,
      )

      const report = await evaluateNarrativeMemory({ rootPath: root })

      expect(report.ok).toBe(false)
      expect(report.cases.find((result) => result.id === 'l0-codex-fact')).toMatchObject(
        {
          ok: false,
          missing: ['李长老', '金丹期'],
        },
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
