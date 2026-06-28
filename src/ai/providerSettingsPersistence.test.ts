import { describe, expect, it } from 'vitest'
import {
  applyLoadedProviderApiKey,
  createProviderSecretStore,
  loadProviderSettings,
  saveProviderSettings,
  type ProviderSettingsStorage,
} from './providerSettingsPersistence'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const storage: ProviderSettingsStorage & { values: Map<string, string> } = {
    values,
    getItem(key) {
      return values.get(key) || null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }

  return storage
}

describe('provider settings persistence', () => {
  it('persists non-secret provider fields while omitting the API key', () => {
    const storage = createMemoryStorage()

    saveProviderSettings(
      {
        providerMode: 'openai',
        providerConfig: {
          baseUrl: 'https://gateway.example.com',
          model: 'fiction-model',
          apiKey: 'sk-secret',
        },
      },
      storage,
    )

    const saved = [...storage.values.values()][0]

    expect(saved).toContain('https://gateway.example.com')
    expect(saved).toContain('fiction-model')
    expect(saved).not.toContain('sk-secret')
    expect(JSON.parse(saved)).toEqual({
      providerMode: 'openai',
      providerConfig: {
        baseUrl: 'https://gateway.example.com',
        model: 'fiction-model',
      },
    })
  })

  it('loads persisted provider fields and always resets the API key', () => {
    const storage = createMemoryStorage({
      'novel-engine.provider-settings.v1': JSON.stringify({
        providerMode: 'openai',
        providerConfig: {
          baseUrl: 'https://gateway.example.com',
          model: 'fiction-model',
          apiKey: 'stale-secret',
        },
      }),
    })

    expect(loadProviderSettings(storage)).toEqual({
      providerMode: 'openai',
      providerConfig: {
        baseUrl: 'https://gateway.example.com',
        model: 'fiction-model',
        apiKey: '',
      },
    })
  })

  it('ignores malformed persisted settings', () => {
    const storage = createMemoryStorage({
      'novel-engine.provider-settings.v1': '{',
    })

    expect(loadProviderSettings(storage)).toBeNull()
  })

  it('stores browser API keys only in the injected session map', async () => {
    const browserSecrets = new Map<string, string>()
    const store = createProviderSecretStore({
      isTauri: () => false,
      browserSecrets,
    })

    await store.setApiKey('openai', '  sk-browser-secret  ')

    expect(await store.getApiKey('openai')).toBe('sk-browser-secret')
    expect(browserSecrets.get('openai')).toBe('sk-browser-secret')

    await store.deleteApiKey('openai')

    expect(await store.getApiKey('openai')).toBe('')
    expect(browserSecrets.has('openai')).toBe(false)
  })

  it('uses native secret commands in Tauri runtime', async () => {
    const calls: string[] = []
    const store = createProviderSecretStore({
      isTauri: () => true,
      getSecret: async (providerId) => {
        calls.push(`get:${providerId}`)
        return 'sk-native-secret'
      },
      setSecret: async (providerId, apiKey) => {
        calls.push(`set:${providerId}:${apiKey}`)
      },
      deleteSecret: async (providerId) => {
        calls.push(`delete:${providerId}`)
      },
    })

    expect(await store.getApiKey('openai')).toBe('sk-native-secret')
    await store.setApiKey('openai', '  sk-next-secret  ')
    await store.deleteApiKey('openai')

    expect(calls).toEqual([
      'get:openai',
      'set:openai:sk-next-secret',
      'delete:openai',
    ])
  })

  it('deletes native secrets when the API key is cleared', async () => {
    const calls: string[] = []
    const store = createProviderSecretStore({
      isTauri: () => true,
      getSecret: async () => null,
      setSecret: async (providerId, apiKey) => {
        calls.push(`set:${providerId}:${apiKey}`)
      },
      deleteSecret: async (providerId) => {
        calls.push(`delete:${providerId}`)
      },
    })

    await store.setApiKey('openai', '   ')

    expect(calls).toEqual(['delete:openai'])
  })

  it('does not apply a loaded API key after the user edits during the load', () => {
    const providerConfig = {
      baseUrl: 'https://gateway.example.com',
      model: 'fiction-model',
      apiKey: 'sk-user-typed',
    }

    expect(
      applyLoadedProviderApiKey({
        providerConfig,
        loadedApiKey: 'sk-stale-loaded',
        loadRevision: 1,
        currentRevision: 2,
      }),
    ).toBe(providerConfig)
  })

  it('applies a loaded API key when no user edit happened during the load', () => {
    expect(
      applyLoadedProviderApiKey({
        providerConfig: {
          baseUrl: 'https://gateway.example.com',
          model: 'fiction-model',
          apiKey: '',
        },
        loadedApiKey: 'sk-loaded',
        loadRevision: 3,
        currentRevision: 3,
      }),
    ).toEqual({
      baseUrl: 'https://gateway.example.com',
      model: 'fiction-model',
      apiKey: 'sk-loaded',
    })
  })
})
