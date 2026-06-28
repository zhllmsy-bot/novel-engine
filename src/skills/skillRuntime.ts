import type { ModelProvider } from '../ai/provider'
import type {
  NarrativeMemory,
  SkillContext,
  SkillManifest,
  SkillRunResult,
} from '../types/domain'
import { memorySourceRefs } from '../memory/memorySourceSummary'
import { parseSkillRunResult } from './skillResultSchema'

type BuildContextInput = {
  documentText: string
  selectedText: string
  chapterTitle: string
  memories: NarrativeMemory[]
  skill?: SkillManifest
  userInstruction?: string
}

export type SkillPreviewInput = BuildContextInput & {
  skill: SkillManifest
  provider: ModelProvider
}

export type SkillRunAudit = {
  skill: {
    id: string
    name: string
    version: string
    outputMode: SkillManifest['outputMode']
    riskLevel: SkillManifest['riskLevel']
    requiresReview: boolean
  }
  provider: {
    id: string
    label: string
  }
  prompt: string
  input: {
    required: string[]
    optional: string[]
    available: string[]
    missingRequired: string[]
  }
  retrieval: NonNullable<SkillManifest['retrieval']>
  model: NonNullable<SkillManifest['model']>
  context: {
    chapterTitle: string
    selectedChars: number
    nearbyChars: number
    memoryCount: number
  }
  memorySources: string[]
  memoryLayerSummaries: SkillMemoryLayerSummary[]
  memoryFilter: SkillMemoryFilterAudit
}

export type SkillMemoryLayerSummary = {
  layer: NarrativeMemory['layer']
  count: number
  chars: number
  sources: string[]
}

export type SkillMemoryFilterAudit = {
  beforeCount: number
  afterCount: number
  droppedCount: number
  dropped: SkillMemoryFilterDrop[]
}

export type SkillMemoryFilterDrop = {
  layer: NarrativeMemory['layer']
  source: string
  reason:
    | 'recent_chapters_disabled'
    | 'recall_disabled'
    | 'characters_disabled'
    | 'worldbuilding_disabled'
    | 'source_family_disabled'
}

export type SkillInputResolution = {
  available: string[]
  missingRequired: string[]
}

export type SkillRunPreview = {
  context: SkillContext
  audit: SkillRunAudit
  canRun: boolean
}

export function buildSkillContext(input: BuildContextInput): SkillContext {
  const memoryFilter = input.skill
    ? filterSkillMemoriesWithAudit(input.skill, input.memories)
    : {
        memories: input.memories,
        audit: emptyMemoryFilterAudit(input.memories.length),
      }

  return {
    selectedText: input.selectedText,
    nearbyText: input.documentText,
    chapterTitle: input.chapterTitle,
    chapterSummary: memoryFilter.memories.find(
      (memory) => memory.layer === 'L1 剧情',
    )?.body,
    memories: memoryFilter.memories,
    memoryFilterAudit: memoryFilter.audit,
    userInstruction: input.userInstruction,
  }
}

export function previewSkillRun(input: SkillPreviewInput): SkillRunPreview {
  const context = buildSkillContext(input)
  const audit = buildSkillRunAudit(input.skill, context, input.provider)

  return {
    context,
    audit,
    canRun: audit.input.missingRequired.length === 0,
  }
}

export function filterSkillMemories(
  skill: SkillManifest,
  memories: NarrativeMemory[],
): NarrativeMemory[] {
  return filterSkillMemoriesWithAudit(skill, memories).memories
}

export function filterSkillMemoriesWithAudit(
  skill: SkillManifest,
  memories: NarrativeMemory[],
): { memories: NarrativeMemory[]; audit: SkillMemoryFilterAudit } {
  const retrieval = skill.retrieval || {}
  const dropped: SkillMemoryFilterDrop[] = []
  const included: NarrativeMemory[] = []

  for (const memory of memories) {
    if (
      retrieval.sourceFamilies &&
      !memorySourceRefs(memory.source).some((ref) =>
        retrieval.sourceFamilies?.includes(ref.family),
      )
    ) {
      dropped.push(dropMemory(memory, 'source_family_disabled'))
      continue
    }

    if (retrieval.includeRecentChapters === 0 && memory.layer === 'L2 风格') {
      dropped.push(dropMemory(memory, 'recent_chapters_disabled'))
      continue
    }

    if (
      retrieval.includeRecall === 'none' &&
      memory.layer === 'L3 意图' &&
      isRecallItemMemory(memory)
    ) {
      dropped.push(dropMemory(memory, 'recall_disabled'))
      continue
    }

    if (memory.layer !== 'L0 事实') {
      included.push(memory)
      continue
    }

    if (retrieval.includeCharacters === 'none' && isCharacterMemory(memory)) {
      dropped.push(dropMemory(memory, 'characters_disabled'))
      continue
    }

    if (
      retrieval.includeWorldbuilding === 'none' &&
      isWorldbuildingMemory(memory)
    ) {
      dropped.push(dropMemory(memory, 'worldbuilding_disabled'))
      continue
    }

    included.push(memory)
  }

  return {
    memories: included,
    audit: {
      beforeCount: memories.length,
      afterCount: included.length,
      droppedCount: dropped.length,
      dropped,
    },
  }
}

export function buildSkillRunAudit(
  skill: SkillManifest,
  context: SkillContext,
  provider: ModelProvider,
): SkillRunAudit {
  const inputResolution = resolveSkillInputs(skill, context)

  return {
    skill: {
      id: skill.id,
      name: skill.name,
      version: skill.version,
      outputMode: skill.outputMode,
      riskLevel: skill.riskLevel,
      requiresReview: skill.requiresReview,
    },
    provider: {
      id: provider.id,
      label: provider.label,
    },
    prompt: skill.prompt || skill.description,
    input: {
      required: skill.input?.required || [],
      optional: skill.input?.optional || [],
      available: inputResolution.available,
      missingRequired: inputResolution.missingRequired,
    },
    retrieval: skill.retrieval || {},
    model: skill.model || {},
    context: {
      chapterTitle: context.chapterTitle,
      selectedChars: context.selectedText.length,
      nearbyChars: context.nearbyText.length,
      memoryCount: context.memories.length,
    },
    memorySources: context.memories.map(
      (memory) => `${memory.layer}:${memory.source}`,
    ),
    memoryLayerSummaries: summarizeSkillMemoryLayers(context.memories),
    memoryFilter:
      context.memoryFilterAudit || emptyMemoryFilterAudit(context.memories.length),
  }
}

export function resolveSkillInputs(
  skill: SkillManifest,
  context: SkillContext,
): SkillInputResolution {
  const declaredInputs = [
    ...(skill.input?.required || []),
    ...(skill.input?.optional || []),
  ]
  const available = declaredInputs.filter((inputName) =>
    hasSkillInput(inputName, context),
  )
  const missingRequired = (skill.input?.required || []).filter(
    (inputName) => !hasSkillInput(inputName, context),
  )

  return {
    available,
    missingRequired,
  }
}

export async function runSkillWithProvider(
  skill: SkillManifest,
  context: SkillContext,
  provider: ModelProvider,
): Promise<SkillRunResult> {
  const inputResolution = resolveSkillInputs(skill, context)
  if (inputResolution.missingRequired.length > 0) {
    throw new Error(
      `Skill ${skill.id} missing required input: ${inputResolution.missingRequired.join(', ')}.`,
    )
  }

  const result = parseSkillRunResult(await provider.runSkill({ skill, context }))

  if (result.type !== skill.outputMode) {
    throw new Error(
      `Skill ${skill.id} declared ${skill.outputMode}, but provider returned ${result.type}.`,
    )
  }

  validateSkillResultSchema(skill, result)

  if (result.type === 'rewrite_patch') {
    if (!result.patch.original.trim()) {
      throw new Error(`Skill ${skill.id} returned an empty original text.`)
    }

    if (!result.patch.requiresSnapshot) {
      throw new Error(`Skill ${skill.id} rewrite patches must require snapshots.`)
    }
  }

  return result
}

function validateSkillResultSchema(skill: SkillManifest, result: SkillRunResult) {
  if (result.type !== 'memory_update_proposal') return

  if (skill.outputSchema === 'character_state_proposal') {
    const invalidProposal = result.proposals.find(
      (proposal) => proposal.kind !== 'character_state',
    )
    if (invalidProposal) {
      throw new Error(
        `Skill ${skill.id} declared character_state_proposal, but provider returned ${invalidProposal.kind}.`,
      )
    }
  }

  if (skill.outputSchema === 'plot_thread_proposal') {
    const invalidProposal = result.proposals.find(
      (proposal) => proposal.kind !== 'plot_thread',
    )
    if (invalidProposal) {
      throw new Error(
        `Skill ${skill.id} declared plot_thread_proposal, but provider returned ${invalidProposal.kind}.`,
      )
    }
  }
}

function hasSkillInput(inputName: string, context: SkillContext) {
  switch (inputName) {
    case 'selected_text':
      return Boolean(context.selectedText.trim())
    case 'nearby_text':
      return Boolean(context.nearbyText.trim())
    case 'chapter_summary':
      return Boolean(context.chapterSummary?.trim())
    case 'character_cards':
      return context.memories.some(
        (memory) =>
          memory.layer === 'L0 事实' &&
          (isCharacterMemory(memory) || isCharacterStateMemory(memory)),
      )
    case 'recent_style':
      return context.memories.some((memory) => memory.layer === 'L2 风格')
    case 'plot_memory':
      return context.memories.some((memory) => memory.layer === 'L1 剧情')
    case 'recall_audit':
      return context.memories.some((memory) => memory.layer === 'L3 意图')
    case 'user_instruction':
      return Boolean(context.userInstruction?.trim())
    default:
      return false
  }
}

function isCharacterMemory(memory: NarrativeMemory) {
  return memory.source.includes('codex/characters')
}

function isCharacterStateMemory(memory: NarrativeMemory) {
  return memory.source.startsWith('character_state_log:')
}

function isWorldbuildingMemory(memory: NarrativeMemory) {
  return [
    'codex/world',
    'codex/locations',
    'codex/items',
    'codex/organizations',
  ].some((path) => memory.source.includes(path))
}

function isRecallItemMemory(memory: NarrativeMemory) {
  return memory.source.startsWith('recall:')
}

function dropMemory(
  memory: NarrativeMemory,
  reason: SkillMemoryFilterDrop['reason'],
): SkillMemoryFilterDrop {
  return {
    layer: memory.layer,
    source: memory.source,
    reason,
  }
}

function emptyMemoryFilterAudit(memoryCount: number): SkillMemoryFilterAudit {
  return {
    beforeCount: memoryCount,
    afterCount: memoryCount,
    droppedCount: 0,
    dropped: [],
  }
}

function summarizeSkillMemoryLayers(
  memories: NarrativeMemory[],
): SkillMemoryLayerSummary[] {
  const byLayer = new Map<NarrativeMemory['layer'], SkillMemoryLayerSummary>()

  for (const memory of memories) {
    const summary =
      byLayer.get(memory.layer) ||
      ({
        layer: memory.layer,
        count: 0,
        chars: 0,
        sources: [],
      } satisfies SkillMemoryLayerSummary)

    summary.count += 1
    summary.chars += memory.body.length
    summary.sources.push(memory.source)
    byLayer.set(memory.layer, summary)
  }

  return [...byLayer.values()]
}
