import {
  classifyMemorySource,
  memorySourceFamilyLabels,
  type MemorySourceFamily,
} from '@/memory/memorySourceSummary'

export type MemorySourceChip = {
  kind: string
  label: string
  detail: string
}

export function parseMemorySourceChips(source: string): MemorySourceChip[] {
  return source
    .split(';')
    .flatMap((group) => {
      const part = group.trim()
      if (!part) return []

      const separatorIndex = part.indexOf(':')
      if (separatorIndex < 0) {
        return part
          .split(',')
          .map((detail) => detail.trim())
          .filter(Boolean)
          .map((detail) => {
            const family = classifyMemorySource(detail)
            const kind = family === 'other' ? 'source' : family

            return {
              kind,
              label: sourceKindLabel(kind, family),
              detail,
            }
          })
      }

      const kind = part.slice(0, separatorIndex)
      const rawDetails = part.slice(separatorIndex + 1)

      return rawDetails
        .split(',')
        .map((detail) => detail.trim())
        .filter(Boolean)
        .map((detail) => ({
          kind,
          label: sourceKindLabel(kind),
          detail,
        }))
    })
}

function sourceKindLabel(kind: string, family?: MemorySourceFamily) {
  const labels: Record<string, string> = {
    chapter_summary: '章摘要',
    volume_summary: '卷摘要',
    plot_thread: '伏笔',
    recall: '召回',
    character_state_log: '状态',
    'meta/project.json': '项目',
  }

  if (family && family !== 'other') {
    return memorySourceFamilyLabels[family]
  }

  return labels[kind] || '来源'
}
