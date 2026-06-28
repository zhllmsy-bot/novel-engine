import { describe, expect, it } from 'vitest'
import { applyRewritePatch, validateRewritePatch } from './safeRewrite'

describe('safe rewrite patches', () => {
  it('accepts a patch only when the original text is still present', () => {
    const patch = {
      original: '沈微停在三步之外，没有行礼。',
      proposed: '沈微停在三步之外，仍旧没有行礼。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }

    expect(validateRewritePatch(`雨声里，${patch.original}`, patch)).toEqual({
      ok: true,
      reason: '原文匹配。接受前会创建快照。',
    })
  })

  it('rejects stale patches instead of applying them to changed prose', () => {
    const patch = {
      original: '沈微停在三步之外，没有行礼。',
      proposed: '沈微停在三步之外，仍旧没有行礼。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }

    expect(validateRewritePatch('沈微已经转身离开。', patch).ok).toBe(false)
    expect(() => applyRewritePatch('沈微已经转身离开。', patch)).toThrow(
      '原文已变化，需要重新生成改写建议。',
    )
  })
})
