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
  const codexTerms = new Set(
    (context.codexEntries || []).flatMap((entry) => [
      entry.name,
      ...entry.keywords,
      ...Object.values(entry.currentState),
    ]),
  )
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
  return Array.from(
    text
      .replace(/[和与及、，。！？；：\s]+/g, '\n')
      .matchAll(/[一-龥]{1,7}(?:司|宗|门|派|城|湖|钥|剑|誓|人)/g),
  ).map((match) => match[0])
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values))
}

function criteriaForbiddenTerms(
  criteria: GenerationEvalCriterion[] | undefined,
  category: GenerationEvalCriterion['category'],
) {
  return (criteria || [])
    .filter((criterion) => criterion.category === category)
    .flatMap((criterion) => criterion.notContains || [])
}
