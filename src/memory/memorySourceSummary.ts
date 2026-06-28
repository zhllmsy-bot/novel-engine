import type { NarrativeMemory } from '../types/domain.ts'
import {
  memorySourceFamilyLabels,
  memorySourceFamilyOrder,
  type MemorySourceFamily,
} from '../types/memorySourceFamilies.ts'

export {
  memorySourceFamilyLabels,
  memorySourceFamilyOrder,
  type MemorySourceFamily,
} from '../types/memorySourceFamilies.ts'

export type MemorySourceFamilySummary = {
  family: MemorySourceFamily
  label: string
  memoryCount: number
  sourceCount: number
  selectedChars: number
  sources: string[]
}

export type MemorySourceRef = {
  family: MemorySourceFamily
  source: string
}

export function buildMemorySourceSummary(
  memories: NarrativeMemory[],
): MemorySourceFamilySummary[] {
  const summaries = new Map<
    MemorySourceFamily,
    {
      family: MemorySourceFamily
      label: string
      memoryCount: number
      selectedChars: number
      sources: string[]
      sourceSet: Set<string>
    }
  >()

  for (const memory of memories) {
    const refs = memorySourceRefs(memory.source)
    const countedFamilies = new Set<MemorySourceFamily>()

    for (const ref of refs) {
      const summary = sourceFamilySummary(summaries, ref.family)

      if (!countedFamilies.has(ref.family)) {
        summary.memoryCount += 1
        summary.selectedChars += memory.body.length
        countedFamilies.add(ref.family)
      }

      if (!summary.sourceSet.has(ref.source)) {
        summary.sourceSet.add(ref.source)
        summary.sources.push(ref.source)
      }
    }
  }

  return memorySourceFamilyOrder.flatMap((family) => {
    const summary = summaries.get(family)
    if (!summary) return []

    return [
      {
        family: summary.family,
        label: summary.label,
        memoryCount: summary.memoryCount,
        sourceCount: summary.sourceSet.size,
        selectedChars: summary.selectedChars,
        sources: summary.sources.slice(0, 6),
      },
    ]
  })
}

export function memorySourceRefs(source: string): MemorySourceRef[] {
  const refs = source
    .split(';')
    .flatMap((group) => expandSourceGroup(group.trim()))
    .filter(Boolean)

  return refs.length > 0
    ? refs.map((ref) => ({
        family: classifyMemorySource(ref),
        source: ref,
      }))
    : [{ family: 'other', source }]
}

export function classifyMemorySource(source: string): MemorySourceFamily {
  if (source === 'meta/project.json') return 'project'
  if (source.startsWith('recall:')) return 'recall'
  if (source.startsWith('chapter_summary:')) return 'chapter_summary'
  if (source.startsWith('volume_summary:')) return 'volume_summary'
  if (source.startsWith('plot_thread:')) return 'plot_thread'
  if (source.startsWith('character_state_log:')) return 'character_state_log'
  if (source.includes('codex/')) return 'codex'
  if (source.includes('manuscript/')) return 'manuscript'

  return 'other'
}

function sourceFamilySummary(
  summaries: Map<
    MemorySourceFamily,
    {
      family: MemorySourceFamily
      label: string
      memoryCount: number
      selectedChars: number
      sources: string[]
      sourceSet: Set<string>
    }
  >,
  family: MemorySourceFamily,
) {
  const existing = summaries.get(family)
  if (existing) return existing

  const created = {
    family,
    label: memorySourceFamilyLabels[family],
    memoryCount: 0,
    selectedChars: 0,
    sources: [],
    sourceSet: new Set<string>(),
  }
  summaries.set(family, created)

  return created
}

function expandSourceGroup(group: string): string[] {
  if (!group) return []

  const prefix = multiValueSourcePrefix(group)
  if (prefix) {
    return group
      .slice(prefix.length + 1)
      .split(',')
      .map((detail) => detail.trim())
      .filter(Boolean)
      .map((detail) => `${prefix}:${detail}`)
  }

  if (!group.includes(':')) {
    return group
      .split(',')
      .map((detail) => detail.trim())
      .filter(Boolean)
  }

  return [group]
}

function multiValueSourcePrefix(source: string) {
  const separatorIndex = source.indexOf(':')
  if (separatorIndex < 0) return undefined

  const prefix = source.slice(0, separatorIndex)
  return prefix === 'chapter_summary' ||
    prefix === 'volume_summary' ||
    prefix === 'plot_thread'
    ? prefix
    : undefined
}
