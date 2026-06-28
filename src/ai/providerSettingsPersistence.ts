import {
  defaultProviderConfig,
  type ProviderConfig,
} from './providerRuntime'
import {
  deleteProviderApiKey,
  getProviderApiKey,
  setProviderApiKey,
} from '../platform/tauriProject'
import { isTauriRuntime } from '../platform/runtime'

const providerSettingsStorageKey = 'novel-engine.provider-settings.v1'
const browserProviderSecrets = new Map<string, string>()

export type ProviderRuntimeSettings = {
  providerMode: string
  providerConfig: ProviderConfig
}

export type ProviderSettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

export type ProviderSecretStore = {
  getApiKey(providerId: string): Promise<string>
  setApiKey(providerId: string, apiKey: string): Promise<void>
  deleteApiKey(providerId: string): Promise<void>
}

export type LoadedProviderApiKeyInput = {
  providerConfig: ProviderConfig
  loadedApiKey: string
  loadRevision: number
  currentRevision: number
}

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

export function createProviderSecretStore(options: {
  isTauri?: () => boolean
  getSecret?: typeof getProviderApiKey
  setSecret?: typeof setProviderApiKey
  deleteSecret?: typeof deleteProviderApiKey
  browserSecrets?: Map<string, string>
} = {}): ProviderSecretStore {
  const isTauri = options.isTauri || isTauriRuntime
  const getSecret = options.getSecret || getProviderApiKey
  const setSecret = options.setSecret || setProviderApiKey
  const deleteSecret = options.deleteSecret || deleteProviderApiKey
  const browserSecrets = options.browserSecrets || browserProviderSecrets

  async function deleteStoredApiKey(providerId: string) {
    if (isTauri()) {
      await deleteSecret(providerId)
      return
    }

    browserSecrets.delete(providerId)
  }

  return {
    async getApiKey(providerId) {
      if (isTauri()) {
        return (await getSecret(providerId)) || ''
      }

      return browserSecrets.get(providerId) || ''
    },
    async setApiKey(providerId, apiKey) {
      const trimmedApiKey = apiKey.trim()
      if (!trimmedApiKey) {
        await deleteStoredApiKey(providerId)
        return
      }

      if (isTauri()) {
        await setSecret(providerId, trimmedApiKey)
        return
      }

      browserSecrets.set(providerId, trimmedApiKey)
    },
    async deleteApiKey(providerId) {
      await deleteStoredApiKey(providerId)
    },
  }
}

export function applyLoadedProviderApiKey({
  providerConfig,
  loadedApiKey,
  loadRevision,
  currentRevision,
}: LoadedProviderApiKeyInput): ProviderConfig {
  if (loadRevision !== currentRevision) {
    return providerConfig
  }

  return {
    ...providerConfig,
    apiKey: loadedApiKey,
  }
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}
