import type { CodexEntry, ProjectChapter } from '../project/projectTypes'
import type { GenerationEvalCriterion } from './generationCriteria'

export type EvalGuardResult = {
  id: string
  pass: boolean
  score: number
  reason: string
  matches: string[]
}

export type EvalGuardContext = {
  output: string
  currentChapter?: ProjectChapter
  chapters?: ProjectChapter[]
  codexEntries?: CodexEntry[]
  criteria?: GenerationEvalCriterion[]
  knownFutureTerms?: string[]
}

export function futureLeakGuard(context: EvalGuardContext): EvalGuardResult {
  const futureTerms = [
    ...futureCodexTerms(context),
    ...criteriaForbiddenTerms(context.criteria, 'future_leak'),
    ...(context.knownFutureTerms || []),
  ]
  const matches = uniqueStrings(
    futureTerms.filter((term) => term && context.output.includes(term)),
  )

  return guardResult({
    id: 'futureLeak',
    matches,
    passReason: 'No future-only entities or events appeared.',
    failReason: `Future-only terms leaked: ${matches.join(', ')}`,
  })
}

export function codexViolationGuard(context: EvalGuardContext): EvalGuardResult {
  const matches = criteriaForbiddenTerms(context.criteria, 'setting').filter(
    (term) => context.output.includes(term),
  )

  return guardResult({
    id: 'codexViolation',
    matches: uniqueStrings(matches),
    passReason: 'Generated text avoids configured setting contradictions.',
    failReason: `Configured setting contradictions appeared: ${matches.join(', ')}`,
  })
}

export function entityHallucinationGuard(
  context: EvalGuardContext,
): EvalGuardResult {
  const codexTerms = new Set(buildKnownEntityTerms(context.codexEntries || []))
  const candidateTerms = extractChineseProperTerms(context.output)
  const matches = candidateTerms.filter(
    (term) => term.length >= 2 && !codexTerms.has(term),
  )

  return guardResult({
    id: 'entityHallucination',
    matches: uniqueStrings(matches),
    passReason: 'No unknown prominent entities detected.',
    failReason: `Unknown prominent entities detected: ${matches.join(', ')}`,
  })
}

export function runGenerationGuards(context: EvalGuardContext) {
  return [
    futureLeakGuard(context),
    codexViolationGuard(context),
    entityHallucinationGuard(context),
  ]
}

function futureCodexTerms(context: EvalGuardContext) {
  if (!context.currentChapter || !context.chapters || !context.codexEntries) {
    return []
  }

  const currentOrder = context.currentChapter.order
  const futureText = context.chapters
    .filter((chapter) => chapter.order > currentOrder)
    .map((chapter) => chapter.content)
    .join('\n')

  return context.codexEntries
    .flatMap((entry) => [entry.name, ...entry.keywords])
    .filter((term) => term && futureText.includes(term))
}

function guardResult(input: {
  id: string
  matches: string[]
  passReason: string
  failReason: string
  passWhenMatchesExist?: boolean
}): EvalGuardResult {
  const hasMatches = input.matches.length > 0
  const pass = input.passWhenMatchesExist ? true : !hasMatches

  return {
    id: input.id,
    pass,
    score: pass ? 1 : 0,
    reason: pass ? input.passReason : input.failReason,
    matches: input.matches,
  }
}

function extractChineseProperTerms(text: string) {
  const normalized = text.replace(/[和与及、，。！？；：\s]+/g, '\n')
  const segments = normalized
    .split('\n')
    .map((segment) => segment.trim())
    .filter(Boolean)
  const matches = segments.flatMap((segment) =>
    Array.from(segment.matchAll(/[一-龥]{1,4}(?:司|宗|门|派|城|山|阁|殿|楼|府|洲|谷|塔|寺|坊)/g)).map(
      (match) => match[0],
    ),
  )

  return uniqueStrings(matches.filter(isLikelyStandaloneEntity))
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values))
}

function buildKnownEntityTerms(codexEntries: CodexEntry[]) {
  return codexEntries.flatMap((entry) => {
    const currentStateValues = Object.values(entry.currentState || {}).filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    )
    return [entry.name, ...entry.keywords, ...currentStateValues].flatMap(
      (value) => extractChineseProperTerms(value),
    )
  })
}

function isLikelyStandaloneEntity(term: string) {
  if (term.length < 2 || term.length > 6) {
    return false
  }

  if (term.includes('的') || term.includes('了') || term.includes('这')) {
    return false
  }

  if (/[把将向从在对给与和及说问看听让替是着过又便都并才还再只不没若可但因被会能要拿送交守留退握压护挡认等藏记道先后]/.test(term)) {
    return false
  }

  return !/^[不没别只将把被又来去说问看听让给替从向对并若可但便都也很仍太先再因为是他她它你我其该会能想要应]|^(他们|她们|我们|你们)/.test(
    term,
  )
}

function criteriaForbiddenTerms(
  criteria: GenerationEvalCriterion[] | undefined,
  category: GenerationEvalCriterion['category'],
) {
  return (criteria || [])
    .filter((criterion) => criterion.category === category)
    .flatMap((criterion) => criterion.notContains || [])
}
