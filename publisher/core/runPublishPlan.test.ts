import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDryRunAdapter } from './adapters/dryRunAdapter.ts'
import { ProgressStore } from './progress.ts'
import { runPublishPlan } from './runPublishPlan.ts'

describe('publisher run plan', () => {
  it('skips published chapters and can record dry-run successes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-plan-'))
    const chaptersDir = join(root, 'chapters')
    const progressPath = join(root, 'progress.json')
    await mkdir(chaptersDir)
    await writeFile(join(chaptersDir, 'chapter-001.md'), '# 第1章 起\n\n甲')
    await writeFile(join(chaptersDir, 'chapter-002.md'), '# 第2章 承\n\n乙')

    try {
      const progress = new ProgressStore(progressPath)
      await progress.addPublished(1)

      const report = await runPublishPlan({
        chaptersDir,
        progressPath,
        adapter: createDryRunAdapter(),
        recordSuccess: true,
      })
      const progressJson = JSON.parse(await readFile(progressPath, 'utf8')) as {
        published_chapters: number[]
        chapters: Record<string, { status: string; message: string }>
      }

      expect(report.scanned).toBe(2)
      expect(report.skipped).toBe(1)
      expect(report.attempted).toBe(1)
      expect(report.succeeded).toBe(1)
      expect(report.results[0]?.chapter.number).toBe(2)
      expect(progressJson.published_chapters).toEqual([1, 2])
      expect(progressJson.chapters['2']).toMatchObject({
        status: 'success',
        message: 'Dry run accepted chapter 2: 承 (1 chars)',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not update progress unless recordSuccess is enabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-plan-'))
    const chaptersDir = join(root, 'chapters')
    const progressPath = join(root, 'progress.json')
    await mkdir(chaptersDir)
    await writeFile(join(chaptersDir, 'chapter-001.md'), '# 第1章 起\n\n甲')

    try {
      const report = await runPublishPlan({
        chaptersDir,
        progressPath,
        adapter: createDryRunAdapter(),
      })
      const progress = new ProgressStore(progressPath)

      expect(report.succeeded).toBe(1)
      expect(await progress.loadPublished()).toEqual(new Set())
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
