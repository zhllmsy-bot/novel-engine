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
})
