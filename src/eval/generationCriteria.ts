export type GenerationEvalCriterionCategory =
  | 'callback'
  | 'setting'
  | 'future_leak'

export type GenerationEvalCriterion = {
  id: string
  description: string
  category: GenerationEvalCriterionCategory
  contains?: string[]
  containsAny?: string[]
  notContains?: string[]
}

export type GenerationEvalCriterionResult = GenerationEvalCriterion & {
  ok: boolean
  missing: string[]
  missingAny: string[]
  forbidden: string[]
}

export type GenerationEvalScore = {
  criteria: number
  passed: number
  failed: number
  callbackExpectations: number
  callbackHits: number
  settingExpectations: number
  settingViolations: number
  futureLeakChecks: number
  futureLeaks: number
  results: GenerationEvalCriterionResult[]
}

export function scoreGenerationOutput(
  output: string,
  criteria: GenerationEvalCriterion[],
): GenerationEvalScore {
  const results = criteria.map((criterion) => {
    const missing = (criterion.contains || []).filter(
      (expected) => !output.includes(expected),
    )
    const hasAny =
      !criterion.containsAny?.length ||
      criterion.containsAny.some((expected) => output.includes(expected))
    const forbidden = (criterion.notContains || []).filter((expected) =>
      output.includes(expected),
    )

    return {
      ...criterion,
      ok: missing.length === 0 && hasAny && forbidden.length === 0,
      missing,
      missingAny: hasAny ? [] : criterion.containsAny || [],
      forbidden,
    }
  })
  const callbackResults = results.filter((result) => result.category === 'callback')
  const settingResults = results.filter((result) => result.category === 'setting')
  const futureLeakResults = results.filter(
    (result) => result.category === 'future_leak',
  )

  return {
    criteria: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    callbackExpectations: callbackResults.length,
    callbackHits: callbackResults.filter((result) => result.ok).length,
    settingExpectations: settingResults.length,
    settingViolations: settingResults.filter((result) => !result.ok).length,
    futureLeakChecks: futureLeakResults.length,
    futureLeaks: futureLeakResults.filter(
      (result) => result.forbidden.length > 0,
    ).length,
    results,
  }
}
