import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkPublisherAdapters,
  formatPublisherCheckReport,
} from './publisher-check.ts'

describe('publisher adapter check tool', () => {
  it('reports valid and invalid publisher adapter manifests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-check-'))
    const validDir = join(root, 'valid')
    const invalidDir = join(root, 'invalid')
    await mkdir(validDir, { recursive: true })
    await mkdir(invalidDir, { recursive: true })
    await writeFile(
      join(validDir, 'publisher.adapter.json'),
      JSON.stringify({
        $schema: '../../../schemas/publisher-adapter.schema.json',
        id: 'dry-run',
        display_name: 'Dry Run',
        description: 'Safe precheck.',
        status: 'available',
        runtime: {
          editor_dry_run: true,
        },
        capabilities: ['预检'],
      }),
    )
    await writeFile(
      join(invalidDir, 'publisher.adapter.json'),
      JSON.stringify({
        $schema: '../../../schemas/publisher-adapter.schema.json',
        id: 'Bad Adapter',
        display_name: 'Bad',
        description: 'Broken.',
        status: 'live',
        runtime: {
          editor_dry_run: false,
        },
        capabilities: [],
      }),
    )

    try {
      const report = await checkPublisherAdapters([root])
      const output = formatPublisherCheckReport(report)

      expect(report.checked).toBe(2)
      expect(report.passed).toBe(1)
      expect(report.failed).toBe(1)
      expect(output).toContain('Publisher adapter check: 1/2 passed')
      expect(output).toContain('status 必须是')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails repeated publisher ids across checked manifests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-check-'))
    const firstDir = join(root, 'first')
    const secondDir = join(root, 'second')
    const firstPath = join(firstDir, 'publisher.adapter.json')
    const secondPath = join(secondDir, 'publisher.adapter.json')
    const duplicatePublisher = (displayName: string) =>
      JSON.stringify({
        $schema: '../../../schemas/publisher-adapter.schema.json',
        id: 'duplicate-publisher',
        display_name: displayName,
        description: 'Duplicate publisher id.',
        status: 'planned',
        runtime: {
          editor_dry_run: false,
        },
        capabilities: ['测试'],
      })
    await mkdir(firstDir, { recursive: true })
    await mkdir(secondDir, { recursive: true })
    await writeFile(firstPath, duplicatePublisher('First Publisher'))
    await writeFile(secondPath, duplicatePublisher('Second Publisher'))

    try {
      const report = await checkPublisherAdapters([root])
      const output = formatPublisherCheckReport(report)

      expect(report.checked).toBe(2)
      expect(report.passed).toBe(1)
      expect(report.failed).toBe(1)
      expect(output).toContain(
        'duplicate publisher adapter id duplicate-publisher',
      )
      expect(output).toContain(firstPath)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
