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
})
