import { parse } from 'yaml'
import type {
  SkillManifest,
  SkillModelProfile,
  SkillOutputMode,
  SkillRiskLevel,
} from '../types/domain'
import {
  memorySourceFamilyOrder,
  type MemorySourceFamily,
} from '../types/memorySourceFamilies.ts'

const outputModes = new Set<SkillOutputMode>([
  'report',
  'rewrite_patch',
  'memory_update_proposal',
  'export_artifact',
])

const outputSchemasByMode = {
  report: new Set(['report']),
  rewrite_patch: new Set(['diff_patch']),
  memory_update_proposal: new Set([
    'character_state_proposal',
    'plot_thread_proposal',
    'mixed_memory_update',
  ]),
  export_artifact: new Set(['export_artifact']),
} as const satisfies Record<SkillOutputMode, ReadonlySet<string>>

const riskLevels = new Set<SkillRiskLevel>(['low', 'medium', 'high'])
const modelProfiles = new Set<SkillModelProfile>(['fast', 'balanced', 'deep'])
const autoNoneValues = new Set(['auto', 'none'])
const memorySourceFamilies = new Set<MemorySourceFamily>(memorySourceFamilyOrder)
const skillIdPattern = /^[a-z0-9][a-z0-9_.-]*$/
const inputNames = new Set([
  'selected_text',
  'nearby_text',
  'chapter_summary',
  'character_cards',
  'recent_style',
  'plot_memory',
  'recall_audit',
  'user_instruction',
])

type RawSkill = {
  id?: unknown
  name?: unknown
  version?: unknown
  category?: unknown
  description?: unknown
  risk_level?: unknown
  prompt?: unknown
  input?: {
    required?: unknown
    optional?: unknown
  }
  retrieval?: {
    include_recent_chapters?: unknown
    include_characters?: unknown
    include_worldbuilding?: unknown
    include_recall?: unknown
    source_families?: unknown
  }
  model?: {
    profile?: unknown
    temperature?: unknown
  }
  output?: {
    mode?: unknown
    schema?: unknown
  }
  safety?: {
    require_snapshot_before_apply?: unknown
    require_user_review?: unknown
  }
}

export type SkillParseResult =
  | {
      ok: true
      manifest: SkillManifest
    }
  | {
      ok: false
      errors: string[]
    }

export function parseSkillManifest(source: string): SkillParseResult {
  let raw: RawSkill

  try {
    raw = parse(source) as RawSkill
  } catch (error) {
    return {
      ok: false,
      errors: [`YAML 解析失败: ${String(error)}`],
    }
  }

  const errors: string[] = []
  const outputMode = raw.output?.mode
  const outputSchema = raw.output?.schema
  const riskLevel = raw.risk_level
  const modelProfile = raw.model?.profile
  const requiredInputs = stringArrayField(raw.input?.required)
  const optionalInputs = stringArrayField(raw.input?.optional)
  const includeRecentChapters = nonNegativeIntegerField(
    raw.retrieval?.include_recent_chapters,
  )
  const sourceFamilies = sourceFamiliesField(raw.retrieval?.source_families)
  const temperature = temperatureField(raw.model?.temperature)
  const unknownInputs = [...requiredInputs, ...optionalInputs].filter(
    (inputName) => !inputNames.has(inputName),
  )
  const highRiskOutput =
    outputMode === 'rewrite_patch' || outputMode === 'memory_update_proposal'

  for (const field of ['id', 'name', 'version', 'category', 'description'] as const) {
    if (typeof raw[field] !== 'string' || !raw[field].trim()) {
      errors.push(`${field} 必须是非空字符串。`)
    }
  }

  if (typeof raw.id === 'string' && !skillIdPattern.test(raw.id)) {
    errors.push('id 只能使用小写字母、数字、下划线、点和短横线，且必须以字母或数字开头。')
  }

  if (typeof riskLevel !== 'string' || !riskLevels.has(riskLevel as SkillRiskLevel)) {
    errors.push('risk_level 必须是 low、medium 或 high。')
  }

  if (typeof outputMode !== 'string' || !outputModes.has(outputMode as SkillOutputMode)) {
    errors.push(
      'output.mode 必须是 report、rewrite_patch、memory_update_proposal 或 export_artifact。',
    )
  }

  if (typeof outputSchema !== 'string' || !outputSchema.trim()) {
    errors.push('output.schema 必须是非空字符串。')
  }

  if (
    typeof outputMode === 'string' &&
    outputModes.has(outputMode as SkillOutputMode) &&
    typeof outputSchema === 'string' &&
    !outputSchemasByMode[outputMode as SkillOutputMode].has(outputSchema)
  ) {
    errors.push(
      `output.schema 与 output.mode 不匹配。${outputMode} 只能使用: ${[
        ...outputSchemasByMode[outputMode as SkillOutputMode],
      ].join('、')}。`,
    )
  }

  if (
    typeof modelProfile === 'string' &&
    !modelProfiles.has(modelProfile as SkillModelProfile)
  ) {
    errors.push('model.profile 必须是 fast、balanced 或 deep。')
  }

  if (
    raw.retrieval?.include_recent_chapters !== undefined &&
    includeRecentChapters === undefined
  ) {
    errors.push('retrieval.include_recent_chapters 必须是大于等于 0 的整数。')
  }

  if (raw.model?.temperature !== undefined && temperature === undefined) {
    errors.push('model.temperature 必须是 0 到 2 之间的数字。')
  }

  if (
    raw.retrieval?.source_families !== undefined &&
    sourceFamilies === undefined
  ) {
    errors.push(
      `retrieval.source_families 必须是非空数组，且只能包含: ${memorySourceFamilyOrder.join('、')}。`,
    )
  }

  if (raw.input?.required !== undefined && !isStringArray(raw.input.required)) {
    errors.push('input.required 必须是字符串数组。')
  }

  if (raw.input?.optional !== undefined && !isStringArray(raw.input.optional)) {
    errors.push('input.optional 必须是字符串数组。')
  }

  const duplicateRequiredInputs = duplicateStrings(requiredInputs)
  if (duplicateRequiredInputs.length > 0) {
    errors.push(`input.required 不能包含重复项: ${duplicateRequiredInputs.join('、')}。`)
  }

  const duplicateOptionalInputs = duplicateStrings(optionalInputs)
  if (duplicateOptionalInputs.length > 0) {
    errors.push(`input.optional 不能包含重复项: ${duplicateOptionalInputs.join('、')}。`)
  }

  const duplicateSourceFamilies = sourceFamilies
    ? duplicateStrings(sourceFamilies)
    : []
  if (duplicateSourceFamilies.length > 0) {
    errors.push(
      `retrieval.source_families 不能包含重复项: ${duplicateSourceFamilies.join('、')}。`,
    )
  }

  if (unknownInputs.length > 0) {
    errors.push(
      `input 只能使用这些名称: ${[...inputNames].join('、')}。未知输入: ${unknownInputs.join('、')}。`,
    )
  }

  if (requiredInputs.includes('recent_style') && includeRecentChapters === 0) {
    errors.push(
      'input.required 包含 recent_style 时，retrieval.include_recent_chapters 不能为 0。',
    )
  }

  if (
    requiredInputs.includes('character_cards') &&
    raw.retrieval?.include_characters === 'none'
  ) {
    errors.push(
      'input.required 包含 character_cards 时，retrieval.include_characters 不能为 none。',
    )
  }

  const sourceFamilyInputErrors = sourceFamilyInputContradictions(
    requiredInputs,
    sourceFamilies,
    raw.retrieval?.include_recall,
  )
  errors.push(...sourceFamilyInputErrors)

  if (
    outputMode === 'rewrite_patch' &&
    raw.safety?.require_snapshot_before_apply !== true
  ) {
    errors.push('rewrite_patch Skill 必须声明 safety.require_snapshot_before_apply: true。')
  }

  if (highRiskOutput && raw.safety?.require_user_review === false) {
    errors.push(
      'rewrite_patch 和 memory_update_proposal Skill 必须经过用户审阅，不能将 safety.require_user_review 设为 false。',
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    manifest: {
      id: raw.id as string,
      name: raw.name as string,
      version: raw.version as string,
      category: raw.category as string,
      description: raw.description as string,
      riskLevel: riskLevel as SkillRiskLevel,
      outputMode: outputMode as SkillOutputMode,
      outputSchema: outputSchema as string,
      requiresReview: raw.safety?.require_user_review !== false,
      prompt: stringField(raw.prompt),
      input: {
        required: requiredInputs,
        optional: optionalInputs,
      },
      retrieval: {
        includeRecentChapters,
        includeCharacters: autoNoneField(raw.retrieval?.include_characters),
        includeWorldbuilding: autoNoneField(raw.retrieval?.include_worldbuilding),
        includeRecall: autoNoneField(raw.retrieval?.include_recall),
        sourceFamilies,
      },
      model: {
        profile:
          typeof modelProfile === 'string'
            ? (modelProfile as SkillModelProfile)
            : undefined,
        temperature,
      },
    },
  }
}

function stringField(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function stringArrayField(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
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

function nonNegativeIntegerField(value: unknown) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : undefined
}

function temperatureField(value: unknown) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 2
    ? value
    : undefined
}

function autoNoneField(value: unknown) {
  return typeof value === 'string' && autoNoneValues.has(value)
    ? (value as 'auto' | 'none')
    : undefined
}

function sourceFamiliesField(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined
  }

  return value.every(
    (item): item is MemorySourceFamily =>
      typeof item === 'string' &&
      memorySourceFamilies.has(item as MemorySourceFamily),
  )
    ? value
    : undefined
}

function sourceFamilyInputContradictions(
  requiredInputs: string[],
  sourceFamilies: MemorySourceFamily[] | undefined,
  includeRecall: unknown,
) {
  if (!sourceFamilies) {
    return []
  }

  const errors: string[] = []
  const requiredFamilyGroups: Record<string, MemorySourceFamily[]> = {
    recent_style: ['manuscript'],
    character_cards: ['codex', 'character_state_log'],
    chapter_summary: [
      'manuscript',
      'chapter_summary',
      'volume_summary',
      'plot_thread',
    ],
    plot_memory: [
      'manuscript',
      'chapter_summary',
      'volume_summary',
      'plot_thread',
    ],
    recall_audit: ['project', 'recall'],
  }

  for (const inputName of requiredInputs) {
    const allowedFamilies = requiredFamilyGroups[inputName]
    if (!allowedFamilies) continue

    if (!sourceFamilies.some((family) => allowedFamilies.includes(family))) {
      errors.push(
        `input.required 包含 ${inputName} 时，retrieval.source_families 必须包含: ${allowedFamilies.join('、')} 之一。`,
      )
    }
  }

  if (
    requiredInputs.includes('recall_audit') &&
    includeRecall === 'none' &&
    !sourceFamilies.includes('project')
  ) {
    errors.push(
      'input.required 包含 recall_audit 且 retrieval.include_recall 为 none 时，retrieval.source_families 必须包含 project。',
    )
  }

  return errors
}
