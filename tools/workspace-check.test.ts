import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createNovelProject } from './project-new.ts'
import {
  checkWorkspace,
  formatWorkspaceCheckReport,
} from './workspace-check.ts'

describe('workspace check tool', () => {
  it('aggregates project, memory, and extension checks for the demo project', async () => {
    const report = await checkWorkspace()
    const output = formatWorkspaceCheckReport(report)

    expect(report.ok).toBe(true)
    expect(report.project.ok).toBe(true)
    expect(report.memory.ok).toBe(true)
    expect(report.extensions.ok).toBe(true)
    expect(report.benchmarks).toEqual([])
    expect(output).toContain('Workspace check: OK')
    expect(output).toContain('Project check: OK')
    expect(output).toContain('Memory eval: OK')
    expect(output).toContain('Extension check: OK')
  })

  it('can validate a freshly scaffolded project through the same aggregate gate', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'workspace-check-'))
    const root = join(parent, 'MyNovel')

    try {
      await createNovelProject({
        title: '聚合检查新书',
        outputPath: root,
        force: false,
        help: false,
      })

      const report = await checkWorkspace(root)

      expect(report.ok).toBe(true)
      expect(report.project.stats.memoryEvalExpectations).toBe(4)
      expect(report.memory.stats.passed).toBe(4)
      expect(report.extensions.checked).toBe(9)
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })

  it('can include the repository benchmark suite in the aggregate gate', async () => {
    const report = await checkWorkspace('examples/demo-novel', {
      benchmarkPaths: [
        'examples/long-memory-benchmark',
        'examples/state-drift-benchmark',
        'examples/delayed-payoff-benchmark',
      ],
    })
    const output = formatWorkspaceCheckReport(report)

    expect(report.ok).toBe(true)
    expect(report.benchmarks).toHaveLength(3)
    expect(report.benchmarks.map((benchmark) => benchmark.projectPath)).toEqual([
      'examples/long-memory-benchmark',
      'examples/state-drift-benchmark',
      'examples/delayed-payoff-benchmark',
    ])
    expect(report.benchmarks.map((benchmark) => benchmark.memory.phase0)).toEqual([
      expect.objectContaining({
        ok: true,
        gain: 5,
        requiredGain: 5,
      }),
      expect.objectContaining({
        ok: true,
        gain: 4,
        requiredGain: 4,
      }),
      expect.objectContaining({
        ok: true,
        gain: 4,
        requiredGain: 4,
      }),
    ])
    expect(output).toContain('Benchmark memory eval: OK')
    expect(output).toContain('Benchmark path: examples/long-memory-benchmark')
    expect(output).toContain('Benchmark path: examples/state-drift-benchmark')
    expect(output).toContain('Benchmark path: examples/delayed-payoff-benchmark')
    expect(output).toContain(
      'Phase 0 gate: PASS (100% four-layer vs 17% baseline, gain +5/5)',
    )
    expect(output).toContain(
      'Phase 0 gate: PASS (100% four-layer vs 20% baseline, gain +4/4)',
    )
  })
})
