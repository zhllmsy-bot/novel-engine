import DiffMatchPatch from 'diff-match-patch'
import type { RewritePatch } from '../types/domain'

const dmp = new DiffMatchPatch()

export type DiffPart = {
  op: 'equal' | 'insert' | 'delete'
  text: string
}

export type RewriteUnit = {
  id: string
  originalStart: number
  originalEnd: number
  proposedStart: number
  proposedEnd: number
  original: string
  proposed: string
  diffParts: DiffPart[]
}

export type PatchValidation = {
  ok: boolean
  reason: string
}

export function buildDiffParts(original: string, proposed: string): DiffPart[] {
  const diffs = dmp.diff_main(original, proposed)
  dmp.diff_cleanupSemantic(diffs)

  return diffs.map(([op, text]) => ({
    op: op === 1 ? 'insert' : op === -1 ? 'delete' : 'equal',
    text,
  }))
}

export function validateRewritePatch(
  documentText: string,
  patch: RewritePatch,
): PatchValidation {
  if (!patch.original.trim()) {
    return {
      ok: false,
      reason: '原文为空，不能应用改写。',
    }
  }

  if (!documentText.includes(patch.original)) {
    return {
      ok: false,
      reason: '原文已变化，需要重新生成改写建议。',
    }
  }

  return {
    ok: true,
    reason: '原文匹配。接受前会创建快照。',
  }
}

export function buildRewriteUnits(patch: RewritePatch): RewriteUnit[] {
  const originalSegments = splitRewriteSegments(patch.original)
  const proposedSegments = splitRewriteSegments(patch.proposed)
  const unitCount = Math.max(originalSegments.length, proposedSegments.length)
  const units: RewriteUnit[] = []

  for (let index = 0; index < unitCount; index += 1) {
    const originalSegment = originalSegments[index]
    const proposedSegment = proposedSegments[index]
    const original = originalSegment?.text || ''
    const proposed = proposedSegment?.text || ''

    if (original === proposed || (!original.trim() && !proposed.trim())) {
      continue
    }

    units.push({
      id: `unit-${index}`,
      originalStart: originalSegment?.start ?? patch.original.length,
      originalEnd: originalSegment?.end ?? patch.original.length,
      proposedStart: proposedSegment?.start ?? patch.proposed.length,
      proposedEnd: proposedSegment?.end ?? patch.proposed.length,
      original,
      proposed,
      diffParts: buildDiffParts(original, proposed),
    })
  }

  return units
}

export function applyRewritePatch(
  documentText: string,
  patch: RewritePatch,
): string {
  const validation = validateRewritePatch(documentText, patch)

  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  return documentText.replace(patch.original, patch.proposed)
}

export function applyRewriteUnit(
  documentText: string,
  patch: RewritePatch,
  unitId: string,
): string {
  const validation = validateRewritePatch(documentText, patch)

  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const unit = buildRewriteUnits(patch).find(
    (rewriteUnit) => rewriteUnit.id === unitId,
  )

  if (!unit) {
    throw new Error('未找到可应用的单句改写。')
  }

  const patchStart = documentText.indexOf(patch.original)
  const unitStart = patchStart + unit.originalStart
  const unitEnd = patchStart + unit.originalEnd

  return `${documentText.slice(0, unitStart)}${unit.proposed}${documentText.slice(unitEnd)}`
}

export function acceptRewriteUnitInPatch(
  patch: RewritePatch,
  unitId: string,
): RewritePatch {
  const unit = buildRewriteUnits(patch).find(
    (rewriteUnit) => rewriteUnit.id === unitId,
  )

  if (!unit) {
    throw new Error('未找到可应用的单句改写。')
  }

  return {
    ...patch,
    original: `${patch.original.slice(0, unit.originalStart)}${unit.proposed}${patch.original.slice(unit.originalEnd)}`,
  }
}

export function rejectRewriteUnitInPatch(
  patch: RewritePatch,
  unitId: string,
): RewritePatch {
  const unit = buildRewriteUnits(patch).find(
    (rewriteUnit) => rewriteUnit.id === unitId,
  )

  if (!unit) {
    throw new Error('未找到可拒绝的单句改写。')
  }

  return {
    ...patch,
    proposed: `${patch.proposed.slice(0, unit.proposedStart)}${unit.original}${patch.proposed.slice(unit.proposedEnd)}`,
  }
}

function splitRewriteSegments(value: string) {
  const matches = value.matchAll(/[^。！？!?\s][^。！？!?]*[。！？!?]?/g)

  return [...matches].map((match) => ({
    text: match[0].trim(),
    start: match.index || 0,
    end: (match.index || 0) + match[0].length,
  }))
}
