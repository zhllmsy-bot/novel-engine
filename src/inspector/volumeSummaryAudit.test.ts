import { describe, expect, it } from 'vitest'
import type { MemoryBudgetAuditEntry } from '@/memory/memoryContextBuilder'
import { volumeSummaryPromptAudit } from './volumeSummaryAudit'

function auditEntry(
  source: string,
  status: MemoryBudgetAuditEntry['status'],
): MemoryBudgetAuditEntry {
  return {
    layer: 'L1 剧情',
    source,
    priority: 100,
    originalChars: 120,
    selectedChars: status === 'dropped' ? 0 : 80,
    status,
  }
}

describe('volume summary prompt audit', () => {
  it('marks volume summaries included by the current prompt audit', () => {
    expect(
      volumeSummaryPromptAudit('volume-001', [
        auditEntry('chapter_summary:chapter-001;volume_summary:volume-001', 'included'),
      ]),
    ).toMatchObject({
      status: 'included',
      label: '已注入',
    })
  })

  it('marks volume summaries whose L1 entry was truncated', () => {
    expect(
      volumeSummaryPromptAudit('volume-001', [
        auditEntry('chapter_summary:chapter-001;volume_summary:volume-001', 'truncated'),
      ]),
    ).toMatchObject({
      status: 'truncated',
      label: '随 L1 截断',
    })
  })

  it('marks volume summaries dropped by the current budget', () => {
    expect(
      volumeSummaryPromptAudit('volume-001', [
        auditEntry('chapter_summary:chapter-001;volume_summary:volume-001', 'dropped'),
      ]),
    ).toMatchObject({
      status: 'dropped',
      label: '预算丢弃',
    })
  })

  it('marks cached volume summaries unused when no audit entry references them', () => {
    expect(
      volumeSummaryPromptAudit('volume-001', [
        auditEntry('chapter_summary:chapter-001;volume_summary:volume-002', 'included'),
      ]),
    ).toMatchObject({
      status: 'unused',
      label: '未使用',
    })
  })
})
