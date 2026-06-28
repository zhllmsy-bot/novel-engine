import { describe, expect, it, vi } from 'vitest'
import type { CharacterStateLog } from '../memory/characterStateLogStore'
import { createCharacterStateLogPersistence } from './characterStateLogPersistence'

const log: CharacterStateLog = {
  kind: 'character_state',
  id: 'state-1',
  chapterId: 'chapter-001',
  chapterTitle: '第001章 山门雨',
  characterName: '沈微',
  field: '心理状态',
  from: '胆怯',
  to: '正面反抗',
  reason: '他没有退让。',
  evidence: '沈微没有退。',
  confidence: 'medium',
  sourceSkillId: 'xuanhuan.state_proposal',
  confirmedAt: '2026-06-25T00:00:00.000Z',
}

describe('character state log persistence', () => {
  it('does not touch Tauri state-log commands in the browser demo runtime', async () => {
    const listLogs = vi.fn()
    const insertLog = vi.fn()
    const persistence = createCharacterStateLogPersistence({
      detector: { isTauri: () => false },
      listLogs,
      insertLog,
    })

    await expect(persistence.loadCharacterStateLogs('/novel')).resolves.toEqual([])
    await persistence.saveCharacterStateLog('/novel', log)

    expect(listLogs).not.toHaveBeenCalled()
    expect(insertLog).not.toHaveBeenCalled()
  })

  it('loads cached Tauri state logs into the memory shape', async () => {
    const persistence = createCharacterStateLogPersistence({
      detector: { isTauri: () => true },
      listLogs: vi.fn().mockResolvedValue([
        {
          id: 'state-1',
          chapter_id: 'chapter-001',
          chapter_title: '第001章 山门雨',
          character_name: '沈微',
          field: '心理状态',
          from_value: '胆怯',
          to_value: '正面反抗',
          reason: '他没有退让。',
          evidence: '沈微没有退。',
          confidence: 'medium',
          source_skill_id: 'xuanhuan.state_proposal',
          confirmed_at: '2026-06-25T00:00:00.000Z',
        },
      ]),
    })

    await expect(persistence.loadCharacterStateLogs('/novel')).resolves.toEqual([
      log,
    ])
  })

  it('writes state logs through the Tauri cache adapter', async () => {
    const insertLog = vi.fn().mockResolvedValue(undefined)
    const persistence = createCharacterStateLogPersistence({
      detector: { isTauri: () => true },
      insertLog,
    })

    await persistence.saveCharacterStateLog('/novel', log)

    expect(insertLog).toHaveBeenCalledWith('/novel', {
      id: 'state-1',
      chapter_id: 'chapter-001',
      chapter_title: '第001章 山门雨',
      character_name: '沈微',
      field: '心理状态',
      from_value: '胆怯',
      to_value: '正面反抗',
      reason: '他没有退让。',
      evidence: '沈微没有退。',
      confidence: 'medium',
      source_skill_id: 'xuanhuan.state_proposal',
      confirmed_at: '2026-06-25T00:00:00.000Z',
    })
  })

  it('propagates cache persistence failures', async () => {
    const persistence = createCharacterStateLogPersistence({
      detector: { isTauri: () => true },
      insertLog: vi.fn().mockRejectedValue(new Error('cache locked')),
    })

    await expect(
      persistence.saveCharacterStateLog('/novel', log),
    ).rejects.toThrow('cache locked')
  })
})
