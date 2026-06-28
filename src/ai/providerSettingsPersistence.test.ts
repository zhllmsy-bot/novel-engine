import { describe, expect, it } from 'vitest'
import {
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
})
