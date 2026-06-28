export type PublisherAdapterStatus = 'available' | 'configured' | 'planned'

export type PublisherAdapterManifest = {
  id: string
  displayName: string
  description: string
  status: PublisherAdapterStatus
  configPath?: string
  capabilities: string[]
  runtime: {
    editorDryRun: boolean
  }
}

export type PublisherAdapterManifestParseResult =
  | {
      ok: true
      manifest: PublisherAdapterManifest
    }
  | {
      ok: false
      errors: string[]
    }

type RawPublisherAdapterManifest = {
  $schema?: unknown
  id?: unknown
  display_name?: unknown
  description?: unknown
  status?: unknown
  config_path?: unknown
  capabilities?: unknown
  runtime?: unknown
}

type RawPublisherAdapterRuntime = {
  editor_dry_run?: unknown
}

const adapterIdPattern = /^[a-z0-9][a-z0-9_.-]*$/
const adapterStatuses = new Set<PublisherAdapterStatus>([
  'available',
  'configured',
  'planned',
])
const adapterManifestFields = new Set([
  '$schema',
  'id',
  'display_name',
  'description',
  'status',
  'config_path',
  'capabilities',
  'runtime',
])
const adapterRuntimeFields = new Set(['editor_dry_run'])

export function parsePublisherAdapterManifest(
  source: string,
): PublisherAdapterManifestParseResult {
  let raw: RawPublisherAdapterManifest

  try {
    raw = JSON.parse(source) as RawPublisherAdapterManifest
  } catch (error) {
    return {
      ok: false,
      errors: [`JSON 解析失败: ${String(error)}`],
    }
  }

  const errors: string[] = []
  const unknownFields = Object.keys(raw).filter(
    (field) => !adapterManifestFields.has(field),
  )
  if (unknownFields.length > 0) {
    errors.push(`未知字段: ${unknownFields.join('、')}。`)
  }

  if (typeof raw.$schema !== 'string' || !raw.$schema.trim()) {
    errors.push('$schema 必须是非空字符串。')
  }

  for (const field of ['id', 'display_name', 'description'] as const) {
    if (typeof raw[field] !== 'string' || !raw[field].trim()) {
      errors.push(`${field} 必须是非空字符串。`)
    }
  }

  if (typeof raw.id === 'string' && !adapterIdPattern.test(raw.id)) {
    errors.push('id 只能使用小写字母、数字、下划线、点和短横线，且必须以字母或数字开头。')
  }

  if (
    typeof raw.status !== 'string' ||
    !adapterStatuses.has(raw.status as PublisherAdapterStatus)
  ) {
    errors.push('status 必须是 available、configured 或 planned。')
  }

  if (raw.config_path !== undefined && typeof raw.config_path !== 'string') {
    errors.push('config_path 必须是字符串。')
  }

  if (!isNonEmptyStringArray(raw.capabilities)) {
    errors.push('capabilities 必须是非空字符串数组。')
  }

  const capabilities = stringArrayField(raw.capabilities)
  const duplicateCapabilities = duplicateStrings(capabilities)
  if (duplicateCapabilities.length > 0) {
    errors.push(`capabilities 不能包含重复项: ${duplicateCapabilities.join('、')}。`)
  }

  const runtime =
    raw.runtime !== undefined ? (raw.runtime as RawPublisherAdapterRuntime) : undefined
  if (!isRecord(raw.runtime)) {
    errors.push('runtime 必须是对象。')
  }

  if (isRecord(raw.runtime)) {
    const unknownRuntimeFields = Object.keys(raw.runtime).filter(
      (field) => !adapterRuntimeFields.has(field),
    )
    if (unknownRuntimeFields.length > 0) {
      errors.push(`runtime 未知字段: ${unknownRuntimeFields.join('、')}。`)
    }
  }

  if (typeof runtime?.editor_dry_run !== 'boolean') {
    errors.push('runtime.editor_dry_run 必须是布尔值。')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    manifest: {
      id: raw.id as string,
      displayName: raw.display_name as string,
      description: raw.description as string,
      status: raw.status as PublisherAdapterStatus,
      configPath:
        typeof raw.config_path === 'string' && raw.config_path.trim()
          ? raw.config_path
          : undefined,
      capabilities: raw.capabilities as string[],
      runtime: {
        editorDryRun: runtime?.editor_dry_run === true,
      },
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
