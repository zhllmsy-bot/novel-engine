import DiffMatchPatch from 'diff-match-patch'
import type { RewritePatch } from '../types/domain'

const dmp = new DiffMatchPatch()

export type DiffPart = {
  op: 'equal' | 'insert' | 'delete'
  text: string
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
