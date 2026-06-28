import { z } from 'zod'
import type { SkillRunResult } from '../types/domain'

const auditTrailSchema = z.array(z.string().min(1))

const rewritePatchSchema = z.object({
  type: z.literal('rewrite_patch'),
  patch: z.object({
    original: z.string().min(1),
    proposed: z.string().min(1),
    skillId: z.string().min(1),
    requiresSnapshot: z.literal(true),
  }).strict(),
  auditTrail: auditTrailSchema,
}).strict()

const reportSchema = z.object({
  type: z.literal('report'),
  title: z.string().min(1),
  body: z.string().min(1),
  auditTrail: auditTrailSchema,
}).strict()

const characterStateChangeProposalSchema = z.object({
  kind: z.literal('character_state'),
  characterName: z.string().min(1),
  field: z.string().min(1),
  from: z.string().optional(),
  to: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
}).strict()

const plotThreadChangeProposalSchema = z.object({
  kind: z.literal('plot_thread'),
  title: z.string().min(1),
  content: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  relatedCharacters: z.array(z.string().min(1)).optional(),
  evidence: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
}).strict()

const memoryUpdateProposalSchema = z.object({
  type: z.literal('memory_update_proposal'),
  title: z.string().min(1),
  body: z.string().min(1),
  proposals: z.array(
    z.union([characterStateChangeProposalSchema, plotThreadChangeProposalSchema]),
  ).min(1),
  auditTrail: auditTrailSchema,
}).strict()

const exportArtifactSchema = z.object({
  type: z.literal('export_artifact'),
  title: z.string().min(1),
  body: z.string().min(1),
  auditTrail: auditTrailSchema,
}).strict()

export const skillRunResultSchema = z.discriminatedUnion('type', [
  rewritePatchSchema,
  reportSchema,
  memoryUpdateProposalSchema,
  exportArtifactSchema,
])

export function parseSkillRunResult(value: unknown): SkillRunResult {
  return skillRunResultSchema.parse(value)
}
