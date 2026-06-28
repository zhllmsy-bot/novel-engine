import {
  defaultProviderConfig,
  type ProviderConfig,
} from './providerRuntime'

const providerSettingsStorageKey = 'novel-engine.provider-settings.v1'

export type ProviderRuntimeSettings = {
  providerMode: string
  providerConfig: ProviderConfig
}

export type ProviderSettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

type PersistedProviderSettings = {
  providerMode?: unknown
  providerConfig?: {
    baseUrl?: unknown
    model?: unknown
    apiKey?: unknown
  }
}

export function loadProviderSettings(
  storage: ProviderSettingsStorage | null = browserProviderSettingsStorage(),
): ProviderRuntimeSettings | null {
  if (!storage) return null

  const source = storage.getItem(providerSettingsStorageKey)
  if (!source) return null

  let parsed: PersistedProviderSettings
  try {
    parsed = JSON.parse(source) as PersistedProviderSettings
  } catch {
    return null
  }

  return {
    providerMode:
      typeof parsed.providerMode === 'string' && parsed.providerMode.trim()
        ? parsed.providerMode
        : 'mock',
    providerConfig: {
      ...defaultProviderConfig,
      baseUrl: stringOrDefault(
        parsed.providerConfig?.baseUrl,
        defaultProviderConfig.baseUrl,
      ),
      model: stringOrDefault(
        parsed.providerConfig?.model,
        defaultProviderConfig.model,
      ),
      apiKey: '',
    },
  }
}

export function saveProviderSettings(
  settings: ProviderRuntimeSettings,
  storage: ProviderSettingsStorage | null = browserProviderSettingsStorage(),
) {
  if (!storage) return

  storage.setItem(
    providerSettingsStorageKey,
    JSON.stringify({
      providerMode: settings.providerMode,
      providerConfig: {
        baseUrl: settings.providerConfig.baseUrl,
        model: settings.providerConfig.model,
      },
    }),
  )
}

export function browserProviderSettingsStorage() {
  return typeof window === 'undefined' ? null : window.localStorage
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}
