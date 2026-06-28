export type ProviderAdapterStatus = 'available' | 'configured' | 'planned'

export type ProviderAdapterKind = 'local' | 'openai-compatible'

export type ProviderConfigField = 'baseUrl' | 'model' | 'apiKey'

export type ProviderAdapterManifest = {
  id: string
  label: string
  kind: ProviderAdapterKind
  description: string
  status: ProviderAdapterStatus
  configFields: ProviderConfigField[]
  capabilities: string[]
  sourceKind?: 'bundled' | 'project'
  path?: string
}

export type ProviderAdapterManifestParseResult =
  | {
      ok: true
      manifest: ProviderAdapterManifest
    }
  | {
      ok: false
      errors: string[]
    }

type RawProviderAdapterManifest = {
  $schema?: unknown
  id?: unknown
  label?: unknown
  kind?: unknown
  description?: unknown
  status?: unknown
  config_fields?: unknown
  capabilities?: unknown
}

const providerIdPattern = /^[a-z0-9][a-z0-9_.-]*$/
const providerStatuses = new Set<ProviderAdapterStatus>([
  'available',
  'configured',
  'planned',
])
const providerKinds = new Set<ProviderAdapterKind>(['local', 'openai-compatible'])
const providerConfigFields = new Set<ProviderConfigField>([
  'baseUrl',
  'model',
  'apiKey',
])
const providerManifestFields = new Set([
  '$schema',
  'id',
  'label',
  'kind',
  'description',
  'status',
  'config_fields',
  'capabilities',
])

export function parseProviderAdapterManifest(
  source: string,
): ProviderAdapterManifestParseResult {
  let raw: RawProviderAdapterManifest

  try {
    raw = JSON.parse(source) as RawProviderAdapterManifest
  } catch (error) {
    return {
      ok: false,
      errors: [`JSON 解析失败: ${String(error)}`],
    }
  }

  const errors: string[] = []
  const unknownFields = Object.keys(raw).filter(
    (field) => !providerManifestFields.has(field),
  )
  if (unknownFields.length > 0) {
    errors.push(`未知字段: ${unknownFields.join('、')}。`)
  }

  if (typeof raw.$schema !== 'string' || !raw.$schema.trim()) {
    errors.push('$schema 必须是非空字符串。')
  }

  for (const field of ['id', 'label', 'description'] as const) {
    if (typeof raw[field] !== 'string' || !raw[field].trim()) {
      errors.push(`${field} 必须是非空字符串。`)
    }
  }

  if (typeof raw.id === 'string' && !providerIdPattern.test(raw.id)) {
    errors.push('id 只能使用小写字母、数字、下划线、点和短横线，且必须以字母或数字开头。')
  }

  if (
    typeof raw.kind !== 'string' ||
    !providerKinds.has(raw.kind as ProviderAdapterKind)
  ) {
    errors.push('kind 必须是 local 或 openai-compatible。')
  }

  if (
    typeof raw.status !== 'string' ||
    !providerStatuses.has(raw.status as ProviderAdapterStatus)
  ) {
    errors.push('status 必须是 available、configured 或 planned。')
  }

  const configFields = stringArrayField(raw.config_fields)
  const unknownConfigFields = configFields.filter(
    (field) => !providerConfigFields.has(field as ProviderConfigField),
  )
  if (!Array.isArray(raw.config_fields)) {
    errors.push('config_fields 必须是字符串数组。')
  } else if (unknownConfigFields.length > 0) {
    errors.push(`未知 config_fields: ${unknownConfigFields.join('、')}。`)
  }

  const duplicateConfigFields = duplicateStrings(configFields)
  if (duplicateConfigFields.length > 0) {
    errors.push(`config_fields 不能包含重复项: ${duplicateConfigFields.join('、')}。`)
  }

  if (raw.kind === 'openai-compatible') {
    const missingConfigFields = ['baseUrl', 'model'].filter(
      (field) => !configFields.includes(field),
    )
    if (missingConfigFields.length > 0) {
      errors.push(
        `openai-compatible provider 必须声明 config_fields: ${missingConfigFields.join('、')}。`,
      )
    }
  }

  if (raw.kind === 'local' && configFields.includes('apiKey')) {
    errors.push('local provider 不能声明 apiKey config_fields。')
  }

  if (!isNonEmptyStringArray(raw.capabilities)) {
    errors.push('capabilities 必须是非空字符串数组。')
  }

  const capabilities = stringArrayField(raw.capabilities)
  const duplicateCapabilities = duplicateStrings(capabilities)
  if (duplicateCapabilities.length > 0) {
    errors.push(`capabilities 不能包含重复项: ${duplicateCapabilities.join('、')}。`)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    manifest: {
      id: raw.id as string,
      label: raw.label as string,
      kind: raw.kind as ProviderAdapterKind,
      description: raw.description as string,
      status: raw.status as ProviderAdapterStatus,
      configFields: configFields as ProviderConfigField[],
      capabilities: raw.capabilities as string[],
    },
  }
}

function stringArrayField(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function duplicateStrings(values: string[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }

  return [...duplicates]
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && Boolean(item.trim()))
  )
}
