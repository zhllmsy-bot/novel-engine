import { describe, expect, it } from 'vitest'
import providerTemplateSource from '../../examples/adapters/provider-adapter-template/provider.adapter.json?raw'
import mockProviderManifestSource from '../../providers/mock/provider.adapter.json?raw'
import openAIProviderManifestSource from '../../providers/openai/provider.adapter.json?raw'
import providerSchemaSource from '../../schemas/provider-adapter.schema.json?raw'
import { parseProviderAdapterManifest } from './providerManifest'

describe('provider adapter manifests', () => {
  it('ships a JSON schema with the supported provider contract', () => {
    const schema = JSON.parse(providerSchemaSource) as {
      properties: {
        kind: { enum: string[] }
        status: { enum: string[] }
        config_fields: {
          items: { enum: string[] }
        }
      }
      allOf: unknown[]
    }

    expect(schema.properties.kind.enum).toEqual([
      'local',
      'openai-compatible',
    ])
    expect(schema.properties.status.enum).toEqual([
      'available',
      'configured',
      'planned',
    ])
    expect(schema.properties.config_fields.items.enum).toEqual([
      'baseUrl',
      'model',
      'apiKey',
    ])
    expect(schema.allOf.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps bundled provider manifests linked to the public schema', () => {
    for (const source of [mockProviderManifestSource, openAIProviderManifestSource]) {
      const raw = JSON.parse(source) as { $schema?: string }
      const result = parseProviderAdapterManifest(source)

      expect(raw.$schema).toBe('../../schemas/provider-adapter.schema.json')
      expect(result.ok).toBe(true)
    }
  })

  it('keeps the community provider adapter template parseable', () => {
    const raw = JSON.parse(providerTemplateSource) as { $schema?: string }
    const result = parseProviderAdapterManifest(providerTemplateSource)

    expect(raw.$schema).toBe(
      '../../../schemas/provider-adapter.schema.json',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest).toMatchObject({
        id: 'community-openai-compatible',
        kind: 'openai-compatible',
        status: 'planned',
      })
    }
  })

  it('parses provider adapter metadata', () => {
    const result = parseProviderAdapterManifest(`
{
  "$schema": "../../schemas/provider-adapter.schema.json",
  "id": "openai",
  "label": "OpenAI Compatible",
  "kind": "openai-compatible",
  "description": "Compatible gateway.",
  "status": "available",
  "config_fields": ["baseUrl", "model", "apiKey"],
  "capabilities": ["BYO-Key"]
}
`)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest).toMatchObject({
        id: 'openai',
        kind: 'openai-compatible',
        configFields: ['baseUrl', 'model', 'apiKey'],
      })
    }
  })

  it('rejects invalid provider adapter metadata', () => {
    const result = parseProviderAdapterManifest(`
{
  "id": "Bad Provider",
  "label": "",
  "kind": "unknown",
  "description": "Broken",
  "status": "live",
  "config_fields": ["token"],
  "capabilities": []
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const errors = result.errors.join('\n')
      expect(errors).toContain('id 只能使用小写字母')
      expect(errors).toContain('label 必须是非空字符串')
      expect(errors).toContain('kind 必须是')
      expect(errors).toContain('status 必须是')
      expect(errors).toContain('未知 config_fields: token')
      expect(errors).toContain('capabilities 必须是非空字符串数组')
    }
  })

  it('rejects duplicate array values to match the public JSON schema', () => {
    const result = parseProviderAdapterManifest(`
{
  "$schema": "../../schemas/provider-adapter.schema.json",
  "id": "duplicate-provider",
  "label": "Duplicate Provider",
  "kind": "openai-compatible",
  "description": "Duplicates manifest arrays.",
  "status": "planned",
  "config_fields": ["baseUrl", "baseUrl"],
  "capabilities": ["BYO-Key", "BYO-Key"]
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const errors = result.errors.join('\n')
      expect(errors).toContain('config_fields 不能包含重复项: baseUrl')
      expect(errors).toContain('capabilities 不能包含重复项: BYO-Key')
    }
  })

  it('rejects unknown fields to match the public JSON schema', () => {
    const result = parseProviderAdapterManifest(`
{
  "$schema": "../../schemas/provider-adapter.schema.json",
  "id": "unknown-field-provider",
  "label": "Unknown Field Provider",
  "kind": "local",
  "description": "Adds unsupported manifest fields.",
  "status": "planned",
  "config_fields": [],
  "capabilities": ["测试"],
  "entrypoint": "provider.js"
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('未知字段: entrypoint')
    }
  })

  it('requires a schema reference for editor validation', () => {
    const result = parseProviderAdapterManifest(`
{
  "id": "missing-schema-provider",
  "label": "Missing Schema Provider",
  "kind": "local",
  "description": "Omits the public schema reference.",
  "status": "planned",
  "config_fields": [],
  "capabilities": ["测试"]
}
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('$schema 必须是非空字符串')
    }
  })

  it('rejects provider kind and config field contradictions', () => {
    const openAICompatible = parseProviderAdapterManifest(`
{
  "$schema": "../../schemas/provider-adapter.schema.json",
  "id": "bad-openai-compatible",
  "label": "Bad OpenAI Compatible",
  "kind": "openai-compatible",
  "description": "Omits required gateway config fields.",
  "status": "planned",
  "config_fields": ["apiKey"],
  "capabilities": ["OpenAI-compatible"]
}
`)
    const local = parseProviderAdapterManifest(`
{
  "$schema": "../../schemas/provider-adapter.schema.json",
  "id": "bad-local",
  "label": "Bad Local",
  "kind": "local",
  "description": "Requires an API key even though it is local.",
  "status": "planned",
  "config_fields": ["apiKey"],
  "capabilities": ["本地验证"]
}
`)

    expect(openAICompatible.ok).toBe(false)
    if (!openAICompatible.ok) {
      expect(openAICompatible.errors.join('\n')).toContain(
        'openai-compatible provider 必须声明 config_fields: baseUrl、model',
      )
    }
    expect(local.ok).toBe(false)
    if (!local.ok) {
      expect(local.errors.join('\n')).toContain(
        'local provider 不能声明 apiKey config_fields',
      )
    }
  })
})
