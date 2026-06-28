import { describe, expect, it } from 'vitest'
import {
  acceptRewriteUnitInPatch,
  applyRewritePatch,
  applyRewriteUnit,
  buildRewriteUnits,
  rejectRewriteUnitInPatch,
  validateRewritePatch,
} from './safeRewrite'

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

  it('builds sentence-level rewrite units only for changed prose', () => {
    const patch = {
      original: '沈微停在三步之外，没有行礼。雨声落在剑鞘上。他没有回头。',
      proposed: '沈微停在三步之外，仍旧没有行礼。雨声敲在剑鞘上。他没有回头。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }

    const units = buildRewriteUnits(patch)

    expect(units).toHaveLength(2)
    expect(units.map((unit) => unit.original)).toEqual([
      '沈微停在三步之外，没有行礼。',
      '雨声落在剑鞘上。',
    ])
    expect(units.map((unit) => unit.proposed)).toEqual([
      '沈微停在三步之外，仍旧没有行礼。',
      '雨声敲在剑鞘上。',
    ])
    expect(units[0].diffParts.some((part) => part.op === 'insert')).toBe(true)
  })

  it('applies only the accepted rewrite unit', () => {
    const documentText =
      '前文。沈微停在三步之外，没有行礼。雨声落在剑鞘上。他没有回头。后文。'
    const patch = {
      original: '沈微停在三步之外，没有行礼。雨声落在剑鞘上。他没有回头。',
      proposed: '沈微停在三步之外，仍旧没有行礼。雨声敲在剑鞘上。他没有回头。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }
    const units = buildRewriteUnits(patch)

    expect(applyRewriteUnit(documentText, patch, units[1].id)).toBe(
      '前文。沈微停在三步之外，没有行礼。雨声敲在剑鞘上。他没有回头。后文。',
    )
  })

  it('applies partial units inside the validated patch span', () => {
    const documentText =
      '雨声落在剑鞘上。沈微停在三步之外，没有行礼。雨声落在剑鞘上。'
    const patch = {
      original: '沈微停在三步之外，没有行礼。雨声落在剑鞘上。',
      proposed: '沈微停在三步之外，仍旧没有行礼。雨声敲在剑鞘上。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }
    const units = buildRewriteUnits(patch)

    expect(applyRewriteUnit(documentText, patch, units[1].id)).toBe(
      '雨声落在剑鞘上。沈微停在三步之外，没有行礼。雨声敲在剑鞘上。',
    )
  })

  it('updates the remaining patch after accepting one unit', () => {
    const patch = {
      original: '沈微停在三步之外，没有行礼。雨声落在剑鞘上。',
      proposed: '沈微停在三步之外，仍旧没有行礼。雨声敲在剑鞘上。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }
    const units = buildRewriteUnits(patch)

    const remainingPatch = acceptRewriteUnitInPatch(patch, units[0].id)

    expect(remainingPatch.original).toBe(
      '沈微停在三步之外，仍旧没有行礼。雨声落在剑鞘上。',
    )
    expect(buildRewriteUnits(remainingPatch).map((unit) => unit.original)).toEqual([
      '雨声落在剑鞘上。',
    ])
  })

  it('updates the remaining patch after rejecting one unit', () => {
    const patch = {
      original: '沈微停在三步之外，没有行礼。雨声落在剑鞘上。',
      proposed: '沈微停在三步之外，仍旧没有行礼。雨声敲在剑鞘上。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }
    const units = buildRewriteUnits(patch)

    const remainingPatch = rejectRewriteUnitInPatch(patch, units[0].id)

    expect(remainingPatch.proposed).toBe(
      '沈微停在三步之外，没有行礼。雨声敲在剑鞘上。',
    )
    expect(buildRewriteUnits(remainingPatch).map((unit) => unit.original)).toEqual([
      '雨声落在剑鞘上。',
    ])
  })

  it('rejects a later unit using proposed offsets after earlier text changed length', () => {
    const patch = {
      original: '沈微停住。雨声落下。',
      proposed: '沈微在石阶前三步停住。雨声敲在瓦上。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }
    const units = buildRewriteUnits(patch)

    const remainingPatch = rejectRewriteUnitInPatch(patch, units[1].id)

    expect(remainingPatch.proposed).toBe('沈微在石阶前三步停住。雨声落下。')
    expect(buildRewriteUnits(remainingPatch).map((unit) => unit.original)).toEqual([
      '沈微停住。',
    ])
  })

  it('rejects inserted and deleted sentence units from the remaining patch', () => {
    const insertionPatch = {
      original: '沈微停在三步之外，没有行礼。',
      proposed:
        '沈微停在三步之外，没有行礼。他把视线落在李长老手中的布囊上。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }
    const deletionPatch = {
      original: '沈微停在三步之外，没有行礼。他没有回头。',
      proposed: '沈微停在三步之外，没有行礼。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }

    expect(
      rejectRewriteUnitInPatch(insertionPatch, buildRewriteUnits(insertionPatch)[0].id)
        .proposed,
    ).toBe('沈微停在三步之外，没有行礼。')
    expect(
      rejectRewriteUnitInPatch(deletionPatch, buildRewriteUnits(deletionPatch)[0].id)
        .proposed,
    ).toBe('沈微停在三步之外，没有行礼。他没有回头。')
  })

  it('builds and applies insertion units when AI adds a sentence', () => {
    const documentText = '前文。沈微停在三步之外，没有行礼。后文。'
    const patch = {
      original: '沈微停在三步之外，没有行礼。',
      proposed:
        '沈微停在三步之外，没有行礼。他把视线落在李长老手中的布囊上。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }

    const units = buildRewriteUnits(patch)

    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({
      original: '',
      proposed: '他把视线落在李长老手中的布囊上。',
    })
    expect(applyRewriteUnit(documentText, patch, units[0].id)).toBe(
      '前文。沈微停在三步之外，没有行礼。他把视线落在李长老手中的布囊上。后文。',
    )
  })

  it('builds and applies deletion units when AI removes a sentence', () => {
    const documentText =
      '前文。沈微停在三步之外，没有行礼。他没有回头。后文。'
    const patch = {
      original: '沈微停在三步之外，没有行礼。他没有回头。',
      proposed: '沈微停在三步之外，没有行礼。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }

    const units = buildRewriteUnits(patch)

    expect(units).toHaveLength(1)
    expect(units[0]).toMatchObject({
      original: '他没有回头。',
      proposed: '',
    })
    expect(applyRewriteUnit(documentText, patch, units[0].id)).toBe(
      '前文。沈微停在三步之外，没有行礼。后文。',
    )
  })

  it('rejects stale partial units instead of replacing unrelated prose', () => {
    const patch = {
      original: '沈微停在三步之外，没有行礼。雨声落在剑鞘上。',
      proposed: '沈微停在三步之外，仍旧没有行礼。雨声敲在剑鞘上。',
      skillId: 'xuanhuan.dialogue_polish',
      requiresSnapshot: true as const,
    }
    const units = buildRewriteUnits(patch)

    expect(() =>
      applyRewriteUnit('沈微已经转身离开。', patch, units[0].id),
    ).toThrow(
      '原文已变化，需要重新生成改写建议。',
    )
  })
})
