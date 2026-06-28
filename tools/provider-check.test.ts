import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkProviderAdapters,
  collectProviderAdapterManifestFiles,
  formatProviderCheckReport,
} from './provider-check.ts'

describe('provider adapter check tool', () => {
  it('collects and checks provider adapter manifests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'provider-check-'))
    const validDir = join(root, 'valid')
    const invalidDir = join(root, 'invalid')
    await mkdir(validDir, { recursive: true })
    await mkdir(invalidDir, { recursive: true })
    await writeFile(
      join(validDir, 'provider.adapter.json'),
      JSON.stringify({
        $schema: '../../schemas/provider-adapter.schema.json',
        id: 'mock',
        label: 'Mock',
        kind: 'local',
        description: 'Local mock.',
        status: 'available',
        config_fields: [],
        capabilities: ['本地验证'],
      }),
    )
    await writeFile(
      join(invalidDir, 'provider.adapter.json'),
      JSON.stringify({
        $schema: '../../schemas/provider-adapter.schema.json',
        id: 'Bad Provider',
        label: 'Bad',
        kind: 'unknown',
        description: 'Broken.',
        status: 'live',
        config_fields: ['token'],
        capabilities: [],
      }),
    )

    try {
      await expect(collectProviderAdapterManifestFiles(root)).resolves.toEqual([
        join(invalidDir, 'provider.adapter.json'),
        join(validDir, 'provider.adapter.json'),
      ])
      const report = await checkProviderAdapters([root])
      const output = formatProviderCheckReport(report)

      expect(report.checked).toBe(2)
      expect(report.passed).toBe(1)
      expect(report.failed).toBe(1)
      expect(output).toContain('Provider adapter check: 1/2 passed')
      expect(output).toContain('kind 必须是')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails repeated provider ids across checked manifests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'provider-check-'))
    const firstDir = join(root, 'first')
    const secondDir = join(root, 'second')
    const firstPath = join(firstDir, 'provider.adapter.json')
    const secondPath = join(secondDir, 'provider.adapter.json')
    const duplicateProvider = (label: string) =>
      JSON.stringify({
        $schema: '../../schemas/provider-adapter.schema.json',
        id: 'duplicate-provider',
        label,
        kind: 'local',
        description: 'Duplicate provider id.',
        status: 'planned',
        config_fields: [],
        capabilities: ['测试'],
      })
    await mkdir(firstDir, { recursive: true })
    await mkdir(secondDir, { recursive: true })
    await writeFile(firstPath, duplicateProvider('First Provider'))
    await writeFile(secondPath, duplicateProvider('Second Provider'))

    try {
      const report = await checkProviderAdapters([root])
      const output = formatProviderCheckReport(report)

      expect(report.checked).toBe(2)
      expect(report.passed).toBe(1)
      expect(report.failed).toBe(1)
      expect(output).toContain(
        'duplicate provider adapter id duplicate-provider',
      )
      expect(output).toContain(firstPath)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
