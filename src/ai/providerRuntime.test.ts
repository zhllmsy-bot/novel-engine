import { describe, expect, it } from 'vitest'
import {
  auditProviderConfig,
  createModelProvider,
  defaultProviderConfig,
  getDefaultProviderAdapterId,
  listRuntimeProviderAdapters,
  validateProviderConfig,
} from './providerRuntime'
import type { ProviderAdapterManifest } from './providerManifest'

const adapters: ProviderAdapterManifest[] = [
  {
    id: 'mock',
    label: 'Mock',
    kind: 'local',
    description: 'Local mock.',
    status: 'available',
    configFields: [],
    capabilities: ['本地验证'],
  },
  {
    id: 'custom-openai',
    label: 'Custom OpenAI',
    kind: 'openai-compatible',
    description: 'OpenAI-compatible gateway.',
    status: 'available',
    configFields: ['baseUrl', 'model', 'apiKey'],
    capabilities: ['OpenAI-compatible'],
  },
]

describe('provider runtime', () => {
  it('exposes bundled provider adapters for runtime selection', () => {
    const bundledAdapters = listRuntimeProviderAdapters()

    expect(bundledAdapters.map((adapter) => adapter.id)).toEqual([
      'mock',
      'openai',
    ])
    expect(getDefaultProviderAdapterId(bundledAdapters)).toBe('mock')
  })

  it('creates providers from manifest-backed adapter ids', () => {
    const mockProvider = createModelProvider('mock', defaultProviderConfig, adapters)
    const openaiProvider = createModelProvider(
      'custom-openai',
      defaultProviderConfig,
      adapters,
    )

    expect(mockProvider.id).toBe('mock.local')
    expect(openaiProvider.id).toBe('openai-compatible')
  })

  it('validates only the config fields declared by the active adapter', () => {
    expect(
      validateProviderConfig(
        'mock',
        { baseUrl: '', model: '', apiKey: '' },
        adapters,
      ),
    ).toBeNull()
    expect(
      validateProviderConfig(
        'custom-openai',
        {
          ...defaultProviderConfig,
          apiKey: '',
        },
        adapters,
      ),
    ).toBe('Custom OpenAI requires API Key.')
  })

  it('audits provider config readiness field by field', () => {
    expect(
      auditProviderConfig(
        'mock',
        { baseUrl: '', model: '', apiKey: '' },
        adapters,
      ),
    ).toMatchObject({
      ready: true,
      requiredFields: [],
      missingFields: [],
    })

    const audit = auditProviderConfig(
      'custom-openai',
      {
        baseUrl: 'http://127.0.0.1:8000',
        model: 'gpt-4.1-mini',
        apiKey: '',
      },
      adapters,
    )

    expect(audit.ready).toBe(false)
    expect(audit.requiredFields).toEqual([
      { field: 'baseUrl', label: 'Base URL', ready: true },
      { field: 'model', label: 'Model', ready: true },
      { field: 'apiKey', label: 'API Key', ready: false },
    ])
    expect(audit.missingFields).toEqual(['apiKey'])
  })

  it('fails loudly for unknown provider adapter ids', () => {
    expect(() =>
      createModelProvider('missing', defaultProviderConfig, adapters),
    ).toThrow('Unknown provider adapter: missing')
  })
})
