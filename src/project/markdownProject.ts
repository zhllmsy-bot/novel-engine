import { parse } from 'yaml'

const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?/

export type ParsedMarkdown = {
  title: string
  body: string
  frontmatter: Record<string, unknown>
  wordCount: number
}
export function parseMarkdownAsset(source: string, fallbackTitle: string): ParsedMarkdown {
  const match = source.match(frontmatterPattern)
  const frontmatter = match ? parseFrontmatter(match[1]) : {}
  const body = match ? source.slice(match[0].length) : source
  const headingTitle = body
    .split('\n')
    .find((line) => line.trim().startsWith('#'))
    ?.replace(/^#+/, '')
    .trim()

  return {
    title: headingTitle || stringField(frontmatter.name) || fallbackTitle,
    body,
    frontmatter,
    wordCount: countNonWhitespace(body),
  }
}

function parseFrontmatter(source: string): Record<string, unknown> {
  const value = parse(source)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

export function stringField(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function stringArrayField(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function countNonWhitespace(value: string) {
  return value.replace(/\s/g, '').length
}
