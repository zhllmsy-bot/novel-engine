import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseProviderAdapterManifest } from '../src/ai/providerManifest.ts'
import { parsePublisherAdapterManifest } from '../publisher/core/adapterManifest.ts'
import {
  buildAdapterTemplate,
  createAdapterManifest,
  parseAdapterNewArgs,
} from './adapter-new.ts'

describe('adapter new tool', () => {
  it('builds a provider adapter manifest that validates', () => {
    const source = buildAdapterTemplate({
      type: 'provider',
      id: 'community-gateway',
      name: 'Community Gateway',
      outputPath: 'providers/community-gateway/provider.adapter.json',
      providerKind: 'openai-compatible',
      force: false,
      help: false,
    })
    const result = parseProviderAdapterManifest(source)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.errors.join('\n'))
    }
    expect(result.manifest).toMatchObject({
      id: 'community-gateway',
      label: 'Community Gateway',
      kind: 'openai-compatible',
      status: 'planned',
      configFields: ['baseUrl', 'model', 'apiKey'],
    })
  })

  it('creates a publisher adapter manifest at the requested path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'adapter-new-publisher-'))
    const outputPath = join(root, 'publisher', 'adapters', 'royalroad', 'publisher.adapter.json')

    try {
      const created = await createAdapterManifest({
        type: 'publisher',
        id: 'royalroad',
        name: 'Royal Road',
        outputPath,
        providerKind: 'openai-compatible',
        force: false,
        help: false,
      })
      const source = await readFile(outputPath, 'utf8')
      const parsed = parsePublisherAdapterManifest(source)

      expect(created).toEqual({
        path: outputPath,
        adapterId: 'royalroad',
        type: 'publisher',
      })
      expect(source).toContain('"editor_dry_run": false')
      expect(parsed.ok).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates a project-local provider adapter and copies the schema', async () => {
    const root = await mkdtemp(join(tmpdir(), 'adapter-new-project-'))

    try {
      const options = parseAdapterNewArgs([
        '--type',
        'provider',
        '--project',
        root,
        '--id',
        'local-qwen',
        '--name',
        'Local Qwen',
        '--provider-kind',
        'local',
      ])
      const created = await createAdapterManifest(options)
      const source = await readFile(created.path, 'utf8')
      const schema = await readFile(
        join(root, '.novel', 'schemas', 'provider-adapter.schema.json'),
        'utf8',
      )
      const parsed = parseProviderAdapterManifest(source)

      expect(options.outputPath).toBe(
        join(root, 'providers', 'local-qwen', 'provider.adapter.json'),
      )
      expect(source).toContain(
        '"$schema": "../../.novel/schemas/provider-adapter.schema.json"',
      )
      expect(schema).toContain('"title": "Novel Engine Provider Adapter Manifest"')
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) {
        throw new Error(parsed.errors.join('\n'))
      }
      expect(parsed.manifest.configFields).toEqual(['baseUrl', 'model'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('resolves --out relative to --project and rejects invalid enum values', () => {
    const root = join(tmpdir(), 'adapter-new-project-root')
    const options = parseAdapterNewArgs([
      '--type',
      'publisher',
      '--project',
      root,
      '--id',
      'fanqie-local',
      '--name',
      '番茄本地上传',
      '--out',
      'publisher/adapters/fanqie-local/publisher.adapter.json',
    ])

    expect(options.outputPath).toBe(
      join(root, 'publisher', 'adapters', 'fanqie-local', 'publisher.adapter.json'),
    )
    expect(options.projectRoot).toBe(root)
    expect(() =>
      parseAdapterNewArgs(['--type', 'runtime', '--id', 'bad', '--name', 'Bad']),
    ).toThrow('--type must be one of')
    expect(() =>
      parseAdapterNewArgs([
        '--type',
        'provider',
        '--id',
        'bad',
        '--name',
        'Bad',
        '--provider-kind',
        'unknown',
      ]),
    ).toThrow('--provider-kind must be one of')
  })
})
