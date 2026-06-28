import { describe, expect, it } from 'vitest'
import {
  buildProviderAdapterCatalog,
  listProviderAdapterManifests,
  loadProjectProviderAdapterCatalog,
} from './providerCatalog'

describe('provider adapter catalog', () => {
  it('loads bundled provider manifests for the provider panel', () => {
    const manifests = listProviderAdapterManifests()

    expect(manifests.map((manifest) => manifest.id)).toEqual(['mock', 'openai'])
    expect(manifests.find((manifest) => manifest.id === 'openai')).toMatchObject({
      kind: 'openai-compatible',
      configFields: ['baseUrl', 'model', 'apiKey'],
      sourceKind: 'bundled',
      path: 'providers/openai/provider.adapter.json',
    })
  })

  it('loads project-local provider manifests after bundled adapters', async () => {
    const catalog = await loadProjectProviderAdapterCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanAdapters: async () => [
        {
          file_path: 'providers/local-qwen/provider.adapter.json',
          content: JSON.stringify({
            $schema: '../../schemas/provider-adapter.schema.json',
            id: 'local-qwen',
            label: 'Local Qwen',
            kind: 'openai-compatible',
            description: 'Project local gateway metadata.',
            status: 'configured',
            config_fields: ['baseUrl', 'model'],
            capabilities: ['项目本地 Provider', 'OpenAI-compatible'],
          }),
        },
      ],
    })

    expect(catalog.errors).toEqual([])
    expect(catalog.adapters.map((adapter) => adapter.id)).toEqual([
      'mock',
      'openai',
      'local-qwen',
    ])
    expect(catalog.adapters.find((adapter) => adapter.id === 'local-qwen')).toMatchObject({
      sourceKind: 'project',
      path: 'providers/local-qwen/provider.adapter.json',
      configFields: ['baseUrl', 'model'],
    })
  })

  it('lets project-local provider manifests override bundled metadata', async () => {
    const catalog = await loadProjectProviderAdapterCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanAdapters: async () => [
        {
          file_path: 'providers/openai/provider.adapter.json',
          content: JSON.stringify({
            $schema: '../../schemas/provider-adapter.schema.json',
            id: 'openai',
            label: 'Community Gateway',
            kind: 'openai-compatible',
            description: 'Project-local OpenAI-compatible gateway.',
            status: 'configured',
            config_fields: ['baseUrl', 'model', 'apiKey'],
            capabilities: ['本地覆盖 metadata'],
          }),
        },
      ],
    })
    const openai = catalog.adapters.find((adapter) => adapter.id === 'openai')

    expect(catalog.adapters.map((adapter) => adapter.id)).toEqual(['mock', 'openai'])
    expect(openai).toMatchObject({
      label: 'Community Gateway',
      sourceKind: 'project',
      path: 'providers/openai/provider.adapter.json',
    })
  })

  it('reports duplicate provider ids declared within the same source kind', () => {
    const providerSource = (label: string) =>
      JSON.stringify({
        $schema: '../../schemas/provider-adapter.schema.json',
        id: 'community',
        label,
        kind: 'local',
        description: 'Duplicate provider id.',
        status: 'planned',
        config_fields: [],
        capabilities: ['测试'],
      })
    const catalog = buildProviderAdapterCatalog([
      {
        path: 'providers/first/provider.adapter.json',
        sourceKind: 'project',
        source: providerSource('First Provider'),
      },
      {
        path: 'providers/second/provider.adapter.json',
        sourceKind: 'project',
        source: providerSource('Second Provider'),
      },
    ])

    expect(catalog.adapters).toHaveLength(1)
    expect(catalog.adapters[0].label).toBe('Second Provider')
    expect(catalog.errors[0]).toContain('duplicate provider adapter id community')
    expect(catalog.errors[0]).toContain('providers/first/provider.adapter.json')
  })

  it('collects invalid project-local provider manifest errors', async () => {
    const catalog = await loadProjectProviderAdapterCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanAdapters: async () => [
        {
          file_path: 'providers/broken/provider.adapter.json',
          content: JSON.stringify({
            $schema: '../../schemas/provider-adapter.schema.json',
            id: 'Broken Provider',
            label: '',
            kind: 'wat',
            description: 'Broken.',
            status: 'planned',
            config_fields: ['token'],
            capabilities: [],
          }),
        },
      ],
    })

    expect(catalog.adapters.map((adapter) => adapter.id)).toEqual(['mock', 'openai'])
    expect(catalog.errors[0]).toContain('providers/broken/provider.adapter.json')
    expect(catalog.errors[0]).toContain('label 必须是非空字符串')
    expect(catalog.errors[0]).toContain('kind 必须是 local 或 openai-compatible')
  })

  it('falls back to bundled provider adapters when project scanning fails', async () => {
    const catalog = await loadProjectProviderAdapterCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanAdapters: async () => {
        throw new Error('permission denied')
      },
    })

    expect(catalog.adapters.map((adapter) => adapter.id)).toEqual(['mock', 'openai'])
    expect(catalog.errors).toEqual(['providers/: permission denied'])
  })

  it('builds provider catalogs from explicit manifest sources', () => {
    const catalog = buildProviderAdapterCatalog([
      {
        path: 'providers/community/provider.adapter.json',
        sourceKind: 'project',
        source: JSON.stringify({
          $schema: '../../schemas/provider-adapter.schema.json',
          id: 'community',
          label: 'Community Provider',
          kind: 'local',
          description: 'Project adapter.',
          status: 'planned',
          config_fields: [],
          capabilities: ['测试'],
        }),
      },
    ])

    expect(catalog).toMatchObject({
      errors: [],
      adapters: [
        {
          id: 'community',
          sourceKind: 'project',
          path: 'providers/community/provider.adapter.json',
        },
      ],
    })
  })
})
