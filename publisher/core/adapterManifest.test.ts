import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  parsePublisherAdapterManifest,
} from './adapterManifest.ts'
import {
  collectPublisherAdapterManifestFiles,
  loadPublisherAdapterManifests,
} from './adapterManifestLoader.ts'

const dryRunManifestSource = readFixture(
  '../adapters/dry-run/publisher.adapter.json',
)
const fanqieManifestSource = readFixture('../adapters/fanqie/publisher.adapter.json')
const publisherTemplateSource = readFixture(
  '../../examples/adapters/publisher-adapter-template/publisher.adapter.json',
)
const publisherSchemaSource = readFixture(
  '../../schemas/publisher-adapter.schema.json',
)

describe('publisher adapter manifests', () => {
  it('ships a JSON schema with the supported publisher contract', () => {
    const schema = JSON.parse(publisherSchemaSource) as {
      properties: {
        status: { enum: string[] }
        runtime: {
          properties: {
            editor_dry_run: { type: string }
          }
        }
      }
    }

    expect(schema.properties.status.enum).toEqual([
      'available',
      'configured',
      'planned',
    ])
    expect(schema.properties.runtime.properties.editor_dry_run.type).toBe(
      'boolean',
    )
  })

  it('keeps bundled publisher manifests linked to the public schema', () => {
    for (const source of [dryRunManifestSource, fanqieManifestSource]) {
      const raw = JSON.parse(source) as { $schema?: string }
      const result = parsePublisherAdapterManifest(source)

      expect(raw.$schema).toBe('../../../schemas/publisher-adapter.schema.json')
      expect(result.ok).toBe(true)
    }
  })

  it('keeps the community publisher adapter template parseable', () => {
    const raw = JSON.parse(publisherTemplateSource) as { $schema?: string }
    const result = parsePublisherAdapterManifest(publisherTemplateSource)

    expect(raw.$schema).toBe('../../../schemas/publisher-adapter.schema.json')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest).toMatchObject({
        id: 'community-publisher',
        status: 'planned',
        runtime: {
          editorDryRun: false,
        },
      })
    }
  })

  it('parses adapter metadata for editor and standalone checks', () => {
    const result = parsePublisherAdapterManifest(`
{
  "$schema": "../../../schemas/publisher-adapter.schema.json",
  "id": "fanqie",
  "display_name": "Fanqie Publisher",
  "description": "Upload chapters through an external adapter.",
  "status": "planned",
  "config_path": "publisher/adapters/fanqie/.env.example",
  "runtime": {
    "editor_dry_run": false
  },
  "capabilities": ["独立 .env 配置"]
}
`)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest).toMatchObject({
        id: 'fanqie',
        displayName: 'Fanqie Publisher',
        status: 'planned',
        configPath: 'publisher/adapters/fanqie/.env.example',
        runtime: {
          editorDryRun: false,
        },
      })
    }
  })

  it('rejects invalid adapter metadata', () => {
    const result = parsePublisherAdapterManifest(`
{
  "id": "Bad Adapter",
  "display_name": "",
  "description": "Broken",
  "status": "live",
  "runtime": {
    "editor_dry_run": "yes"
  },
  "capabilities": []
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const errors = result.errors.join('\n')
      expect(errors).toContain('id 只能使用小写字母')
      expect(errors).toContain('display_name 必须是非空字符串')
      expect(errors).toContain('status 必须是')
      expect(errors).toContain('runtime.editor_dry_run 必须是布尔值')
      expect(errors).toContain('capabilities 必须是非空字符串数组')
    }
  })

  it('rejects duplicate capabilities to match the public JSON schema', () => {
    const result = parsePublisherAdapterManifest(`
{
  "$schema": "../../../schemas/publisher-adapter.schema.json",
  "id": "duplicate-publisher",
  "display_name": "Duplicate Publisher",
  "description": "Duplicates manifest arrays.",
  "status": "planned",
  "runtime": {
    "editor_dry_run": false
  },
  "capabilities": ["预检", "预检"]
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        'capabilities 不能包含重复项: 预检',
      )
    }
  })

  it('rejects unknown fields to match the public JSON schema', () => {
    const result = parsePublisherAdapterManifest(`
{
  "$schema": "../../../schemas/publisher-adapter.schema.json",
  "id": "unknown-field-publisher",
  "display_name": "Unknown Field Publisher",
  "description": "Adds unsupported manifest fields.",
  "status": "planned",
  "runtime": {
    "editor_dry_run": true,
    "apply_immediately": true
  },
  "capabilities": ["预检"],
  "entrypoint": "publisher.js"
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const errors = result.errors.join('\n')
      expect(errors).toContain('未知字段: entrypoint')
      expect(errors).toContain('runtime 未知字段: apply_immediately')
    }
  })

  it('requires a schema reference for editor validation', () => {
    const result = parsePublisherAdapterManifest(`
{
  "id": "missing-schema-publisher",
  "display_name": "Missing Schema Publisher",
  "description": "Omits the public schema reference.",
  "status": "planned",
  "runtime": {
    "editor_dry_run": false
  },
  "capabilities": ["预检"]
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('$schema 必须是非空字符串')
    }
  })

  it('requires explicit editor dry-run runtime support', () => {
    const result = parsePublisherAdapterManifest(`
{
  "$schema": "../../../schemas/publisher-adapter.schema.json",
  "id": "missing-runtime-publisher",
  "display_name": "Missing Runtime Publisher",
  "description": "Omits explicit editor runtime support.",
  "status": "planned",
  "capabilities": ["预检"]
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const errors = result.errors.join('\n')
      expect(errors).toContain('runtime 必须是对象')
      expect(errors).toContain('runtime.editor_dry_run 必须是布尔值')
    }
  })

  it('loads adapter manifests recursively', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-adapters-'))
    const adapterDir = join(root, 'dry-run')
    await mkdir(adapterDir, { recursive: true })
    await writeFile(
      join(adapterDir, 'publisher.adapter.json'),
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
    await writeFile(join(adapterDir, 'notes.json'), '{}')

    try {
      await expect(collectPublisherAdapterManifestFiles(root)).resolves.toEqual([
        join(adapterDir, 'publisher.adapter.json'),
      ])
      await expect(loadPublisherAdapterManifests(root)).resolves.toMatchObject([
        {
          id: 'dry-run',
          displayName: 'Dry Run',
          runtime: {
            editorDryRun: true,
          },
        },
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

function readFixture(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}
