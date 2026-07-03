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
  matchThreshold?: number
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

const defaultPositiveMatchThreshold = 0.7

export function scoreGenerationOutput(
  output: string,
  criteria: GenerationEvalCriterion[],
): GenerationEvalScore {
  const results = criteria.map((criterion) => {
    const threshold = positiveMatchThreshold(criterion)
    const missing = (criterion.contains || []).filter(
      (expected) => !matchesExpected(output, expected, threshold),
    )
    const hasAny =
      !criterion.containsAny?.length ||
      criterion.containsAny.some((expected) =>
        matchesExpected(output, expected, threshold),
      )
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

function positiveMatchThreshold(criterion: GenerationEvalCriterion) {
  const threshold = criterion.matchThreshold ?? defaultPositiveMatchThreshold
  return Number.isFinite(threshold) && threshold > 0 && threshold <= 1
    ? threshold
    : defaultPositiveMatchThreshold
}

function matchesExpected(output: string, expected: string, threshold: number) {
  if (output.includes(expected)) {
    return true
  }

  return fuzzySpecificRatio(output, expected, threshold) >= threshold
}

function fuzzySpecificRatio(output: string, expected: string, threshold: number) {
  const expectedChars = Array.from(expected)
  const outputChars = Array.from(output)

  if (expectedChars.length === 0) {
    return 1
  }

  if (outputChars.length === 0) {
    return 0
  }

  const minWindowLength = Math.max(
    1,
    Math.ceil(expectedChars.length * threshold),
  )
  const maxWindowLength = Math.min(
    outputChars.length,
    Math.floor(expectedChars.length / threshold),
  )
  let bestRatio = 0

  for (
    let windowLength = minWindowLength;
    windowLength <= maxWindowLength;
    windowLength += 1
  ) {
    for (
      let startIndex = 0;
      startIndex <= outputChars.length - windowLength;
      startIndex += 1
    ) {
      const candidate = outputChars.slice(startIndex, startIndex + windowLength)
      const ratio =
        longestCommonSubsequenceLength(expectedChars, candidate) /
        Math.max(expectedChars.length, candidate.length)

      if (ratio >= threshold) {
        return ratio
      }

      bestRatio = Math.max(bestRatio, ratio)
    }
  }

  return bestRatio
}

function longestCommonSubsequenceLength(left: string[], right: string[]) {
  const previous = new Array<number>(right.length + 1).fill(0)
  const current = new Array<number>(right.length + 1).fill(0)

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current[rightIndex + 1] =
        left[leftIndex] === right[rightIndex]
          ? previous[rightIndex] + 1
          : Math.max(previous[rightIndex + 1], current[rightIndex])
    }

    previous.splice(0, previous.length, ...current)
    current.fill(0)
  }

  return previous[right.length]
}
