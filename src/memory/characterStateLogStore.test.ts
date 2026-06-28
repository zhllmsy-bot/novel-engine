import { describe, expect, it } from 'vitest'
import { createCharacterStateLogStore } from './characterStateLogStore'

describe('character state log store', () => {
  it('confirms state proposals into auditable logs', () => {
    const store = createCharacterStateLogStore()
    const log = store.confirmProposal({
      proposal: {
        kind: 'character_state',
        characterName: '沈微',
        field: '心理状态',
        from: '胆怯',
        to: '正面反抗',
        reason: '他没有退让。',
        evidence: '他没有退。',
        confidence: 'medium',
      },
      chapterId: 'chapter-001',
      chapterTitle: '第001章 山门雨',
      sourceSkillId: 'xuanhuan.state_proposal',
    })

    expect(log).toMatchObject({
      characterName: '沈微',
      field: '心理状态',
      to: '正面反抗',
      chapterId: 'chapter-001',
      sourceSkillId: 'xuanhuan.state_proposal',
    })
    expect(store.listLogs()).toHaveLength(1)
  })
})
