import type { CodexEntry } from '../project/projectTypes'

const maxIndexedRecallTerms = 8
const minIndexedRecallTermChars = 3
const maxIndexedRecallTermChars = 10

const properTermSuffixes = [
  '封印',
  '令牌',
  '钥匙',
  '戒律堂',
  '司',
  '宗',
  '门',
  '派',
  '城',
  '湖',
  '钥',
  '剑',
  '令',
  '印',
  '塔',
  '堂',
  '誓',
  '卷',
  '阵',
  '碑',
  '灯',
  '阁',
  '峰',
  '谷',
  '宫',
  '殿',
  '族',
  '盟',
  '镜',
] as const

const suffixPriority = new Map(
  properTermSuffixes.map((suffix, index) => [suffix, index]),
)

const proseTermStopChars = /[的一是在了着过把被将向从到于与和或及而但却又也都只便才并仍很更最让给问说看听想起握住见写第枚落入不能]/
const proseBoundaryChars = /[^\u4e00-\u9fff]|[的一是在了着过把被将向从到于与和或及而但却又也都只便才并仍很更最让给问说看听想起握住见写第枚落入不能]/
const genericRecallTerms = new Set([
  '那个人',
  '这个人',
  '一个人',
  '钥匙',
  '封印',
  '令牌',
  '旧卷',
  '青灯',
])

export function buildIndexedRecallQuery(
  documentText: string,
  codexEntries: CodexEntry[],
) {
  const codexTerms = codexEntries.flatMap((entry) =>
    [entry.name, ...entry.keywords].filter(
      (keyword) => keyword && documentText.includes(keyword),
    ),
  )
  const proseTerms = extractIndexedRecallProseTerms(documentText)
  const terms = uniqueStrings([
    ...uniqueStrings(codexTerms)
      .map(normalizeRecallTerm)
      .filter(isUsefulCodexRecallTerm),
    ...proseTerms,
  ]).slice(0, maxIndexedRecallTerms)

  return terms.join(' ')
}

export function extractIndexedRecallProseTerms(documentText: string) {
  return uniqueStrings(
    usefulClauses(documentText).flatMap((clause) =>
      termsEndingWithKnownSuffixes(clause),
    ),
  ).filter(isUsefulIndexedRecallTerm)
}

function usefulClauses(documentText: string) {
  return documentText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .join(' ')
    .split(/[，,。！？!?；;：:\s]+/)
    .map((clause) => clause.trim())
    .filter(Boolean)
}

function termsEndingWithKnownSuffixes(clause: string) {
  return properTermSuffixes
    .flatMap((suffix) =>
      termsEndingWithSuffix(clause, suffix).map((term) => ({
        ...term,
        suffixPriority: suffixPriority.get(suffix) || 0,
      })),
    )
    .toSorted(
      (left, right) =>
        left.index - right.index || left.suffixPriority - right.suffixPriority,
    )
    .map((term) => term.value)
}

function termsEndingWithSuffix(clause: string, suffix: string) {
  const terms: { index: number; value: string }[] = []
  let searchFrom = 0

  while (searchFrom >= 0) {
    const index = clause.indexOf(suffix, searchFrom)
    if (index < 0) break

    const end = index + suffix.length
    const start = termStartBeforeSuffix(clause, index)
    const term = clause.slice(start, end)
    if (term !== suffix) {
      terms.push({ index: start, value: term })
    }
    searchFrom = end
  }

  return terms
}

function termStartBeforeSuffix(clause: string, suffixStart: number) {
  const earliest = Math.max(0, suffixStart - (maxIndexedRecallTermChars - 1))

  for (let index = suffixStart - 1; index >= earliest; index -= 1) {
    if (proseBoundaryChars.test(clause[index])) {
      return index + 1
    }
  }

  return earliest
}

function normalizeRecallTerm(value: string) {
  return value
    .trim()
    .replace(/^[-_*#>\s]+/, '')
    .replace(/[-_*#>\s]+$/, '')
}

function isUsefulIndexedRecallTerm(term: string) {
  if (term.length < minIndexedRecallTermChars) return false
  if (term.length > maxIndexedRecallTermChars) return false
  if (genericRecallTerms.has(term)) return false
  if (!/^[\u4e00-\u9fffA-Za-z0-9_-]+$/.test(term)) return false

  return !proseTermStopChars.test(term)
}

function isUsefulCodexRecallTerm(term: string) {
  if (term.length < minIndexedRecallTermChars) return false
  if (term.length > maxIndexedRecallTermChars) return false

  return /^[\u4e00-\u9fffA-Za-z0-9_-]+$/.test(term)
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
