import { describe, expect, it } from 'vitest'
import { computeGenerationStructureMetrics } from './structureMetrics'

describe('structure metrics', () => {
  it('measures whether expected claim groups are visible in prompt context', () => {
    const metrics = computeGenerationStructureMetrics({
      prompt: '上下文包含镜湖钥、青灯誓和未来答案红线。',
      criteria: [
        {
          id: 'setting',
          description: 'setting',
          category: 'setting',
          containsAny: ['镜湖钥'],
        },
        {
          id: 'callback',
          description: 'callback',
          category: 'callback',
          containsAny: ['青灯誓'],
        },
        {
          id: 'future',
          description: 'future',
          category: 'future_leak',
          notContains: ['未来答案'],
        },
      ],
    })

    expect(metrics).toEqual([
      expect.objectContaining({ id: 'setting_recall', score: 1 }),
      expect.objectContaining({ id: 'foreshadow_coverage', score: 1 }),
      expect.objectContaining({ id: 'future_guard_coverage', score: 0 }),
    ])
  })
})
