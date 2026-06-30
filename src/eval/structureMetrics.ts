import type { GenerationEvalCriterion } from './generationCriteria'

export type EvalStructureMetric = {
  id: string
  score: number
  numerator: number
  denominator: number
  reason: string
}

export function computeGenerationStructureMetrics(input: {
  prompt: string
  criteria: GenerationEvalCriterion[]
}): EvalStructureMetric[] {
  return [
    criterionCoverageMetric({
      id: 'setting_recall',
      prompt: input.prompt,
      criteria: input.criteria.filter((criterion) => criterion.category === 'setting'),
    }),
    criterionCoverageMetric({
      id: 'foreshadow_coverage',
      prompt: input.prompt,
      criteria: input.criteria.filter((criterion) => criterion.category === 'callback'),
    }),
    criterionCoverageMetric({
      id: 'future_guard_coverage',
      prompt: input.prompt,
      criteria: input.criteria.filter(
        (criterion) => criterion.category === 'future_leak',
      ),
    }),
  ]
}

function criterionCoverageMetric(input: {
  id: string
  prompt: string
  criteria: GenerationEvalCriterion[]
}): EvalStructureMetric {
  const expectedGroups = input.criteria
    .map((criterion) => criterion.contains || criterion.containsAny || [])
    .filter((terms) => terms.length > 0)
  const covered = expectedGroups.filter((terms) =>
    terms.some((term) => input.prompt.includes(term)),
  )

  return {
    id: input.id,
    score: ratio(covered.length, expectedGroups.length),
    numerator: covered.length,
    denominator: expectedGroups.length,
    reason:
      expectedGroups.length > 0
        ? `${covered.length}/${expectedGroups.length} expected claim groups are visible in prompt context.`
        : 'No expected claim groups configured.',
  }
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}
