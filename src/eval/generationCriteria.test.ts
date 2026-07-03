import { describe, expect, it } from 'vitest'
import { scoreGenerationOutput } from './generationCriteria'

describe('generation criteria scoring', () => {
  it('scores callback hits, setting violations, and future leaks separately', () => {
    const criteria = [
      {
        id: 'callback-oath',
        description: 'Recall the oath.',
        category: 'callback' as const,
        containsAny: ['灯灭之前', '青灯誓'],
      },
      {
        id: 'setting-key',
        description: 'Do not hand over the key.',
        category: 'setting' as const,
        notContains: ['交给黑潮司'],
      },
      {
        id: 'future',
        description: 'Do not leak future answer.',
        category: 'future_leak' as const,
        notContains: ['未来答案'],
      },
    ]

    expect(scoreGenerationOutput('灯灭之前，我不会交给黑潮司。', criteria)).toMatchObject({
      callbackHits: 1,
      settingViolations: 1,
      futureLeaks: 0,
    })
    expect(scoreGenerationOutput('未来答案已经出现。', criteria)).toMatchObject({
      callbackHits: 0,
      settingViolations: 0,
      futureLeaks: 1,
    })
  })

  it('scores approximate positive matches as callback hits', () => {
    const criteria = [
      {
        id: 'callback-key',
        description: 'Recall the Mirror Lake Key.',
        category: 'callback' as const,
        containsAny: ['镜湖钥'],
      },
      {
        id: 'callback-gate',
        description: 'Recall the north gate instruction.',
        category: 'callback' as const,
        contains: ['先从我面前过'],
        matchThreshold: 0.66,
      },
    ]

    const score = scoreGenerationOutput(
      '他把镜湖的钥攥紧，只说：“先从我这里过。”',
      criteria,
    )

    expect(score).toMatchObject({
      callbackExpectations: 2,
      callbackHits: 2,
      passed: 2,
    })
  })

  it('does not score approximate forbidden terms as violations', () => {
    const criteria = [
      {
        id: 'setting-key',
        description: 'Do not hand over the key.',
        category: 'setting' as const,
        notContains: ['把镜湖钥交给黑潮司'],
      },
    ]

    expect(
      scoreGenerationOutput('他把镜湖的钥贴身收好，没有交给任何人。', criteria),
    ).toMatchObject({
      settingViolations: 0,
      passed: 1,
    })
  })

  it('still blocks exact forbidden terms', () => {
    const criteria = [
      {
        id: 'setting-key',
        description: 'Do not hand over the key.',
        category: 'setting' as const,
        notContains: ['把镜湖钥交给黑潮司'],
      },
    ]

    expect(
      scoreGenerationOutput('沈泊把镜湖钥交给黑潮司，转身离开。', criteria),
    ).toMatchObject({
      settingViolations: 1,
      passed: 0,
    })
  })
})
