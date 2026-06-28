import { mockProvider } from './mockProvider'
import {
  createOpenAICompatibleProvider,
  type OpenAICompatibleConfig,
} from './openAICompatibleProvider'
import type { ModelProvider } from './provider'
import { listProviderAdapterManifests } from './providerCatalog'
import type {
  ProviderAdapterManifest,
  ProviderConfigField,
} from './providerManifest'

export type ProviderConfig = OpenAICompatibleConfig

export type ProviderConfigFieldStatus = {
  field: ProviderConfigField
  label: string
  ready: boolean
}

export type ProviderConfigAudit = {
  adapter: ProviderAdapterManifest
  requiredFields: ProviderConfigFieldStatus[]
  missingFields: ProviderConfigField[]
  ready: boolean
}

export const defaultProviderConfig: ProviderConfig = {
  baseUrl: 'http://127.0.0.1:8000',
  apiKey: '',
  model: 'gpt-4.1-mini',
}

export function listRuntimeProviderAdapters(): ProviderAdapterManifest[] {
  return listProviderAdapterManifests()
}

export function getDefaultProviderAdapterId(
  adapters = listRuntimeProviderAdapters(),
): string {
  return adapters[0]?.id || 'mock'
}

export function resolveProviderAdapter(
  providerId: string,
  adapters = listRuntimeProviderAdapters(),
): ProviderAdapterManifest {
  const adapter = adapters.find((candidate) => candidate.id === providerId)

  if (!adapter) {
    throw new Error(`Unknown provider adapter: ${providerId}`)
  }

  return adapter
}

export function createModelProvider(
  providerId: string,
  config: ProviderConfig,
  adapters = listRuntimeProviderAdapters(),
): ModelProvider {
  const adapter = resolveProviderAdapter(providerId, adapters)

  if (adapter.kind === 'local') {
    return mockProvider
  }

  return createOpenAICompatibleProvider(config)
}

export function validateProviderConfig(
  providerId: string,
  config: ProviderConfig,
  adapters = listRuntimeProviderAdapters(),
): string | null {
  const audit = auditProviderConfig(providerId, config, adapters)
  const missingField = audit.missingFields[0]

  if (!missingField) {
    return null
  }

  return `${audit.adapter.label} requires ${providerConfigFieldLabels[missingField]}.`
}

export function auditProviderConfig(
  providerId: string,
  config: ProviderConfig,
  adapters = listRuntimeProviderAdapters(),
): ProviderConfigAudit {
  const adapter = resolveProviderAdapter(providerId, adapters)
  const requiredFields = adapter.configFields.map((field) => ({
    field,
    label: providerConfigFieldLabels[field],
    ready: Boolean(String(config[field] || '').trim()),
  }))
  const missingFields = requiredFields
    .filter((field) => !field.ready)
    .map((field) => field.field)

  return {
    adapter,
    requiredFields,
    missingFields,
    ready: missingFields.length === 0,
  }
}

export const providerConfigFieldLabels: Record<ProviderConfigField, string> = {
  baseUrl: 'Base URL',
  model: 'Model',
  apiKey: 'API Key',
}
