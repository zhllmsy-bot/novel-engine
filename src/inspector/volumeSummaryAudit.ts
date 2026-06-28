import type { MemoryBudgetAuditEntry } from '@/memory/memoryContextBuilder'
import { parseMemorySourceChips } from './memorySourceChips'

export type VolumeSummaryPromptStatus =
  | 'included'
  | 'truncated'
  | 'dropped'
  | 'unused'

export type VolumeSummaryPromptAudit = {
  status: VolumeSummaryPromptStatus
  label: string
  description: string
}

export function volumeSummaryPromptAudit(
  volumeId: string,
  entries: MemoryBudgetAuditEntry[],
): VolumeSummaryPromptAudit {
  const matchingEntries = entries.filter((entry) =>
    parseMemorySourceChips(entry.source).some(
      (chip) => chip.kind === 'volume_summary' && chip.detail === volumeId,
    ),
  )

  if (matchingEntries.some((entry) => entry.status === 'included')) {
    return {
      status: 'included',
      label: '已注入',
      description: '当前 Prompt 使用了这条卷摘要。',
    }
  }

  if (matchingEntries.some((entry) => entry.status === 'truncated')) {
    return {
      status: 'truncated',
      label: '随 L1 截断',
      description: '所在 L1 条目被预算截断。',
    }
  }

  if (matchingEntries.some((entry) => entry.status === 'dropped')) {
    return {
      status: 'dropped',
      label: '预算丢弃',
      description: '所在 L1 条目未进入当前 Prompt。',
    }
  }

  return {
    status: 'unused',
    label: '未使用',
    description: '当前章节仍使用章级摘要或不需要远期压缩。',
  }
}
